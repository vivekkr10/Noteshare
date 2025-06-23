// userRoutes.js
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const User = require('../models/user');
const Note = require('../models/notes');
const Otp = require("../models/otp");
const { sendOTPEmail } = require("../utils/sendOtp_temp");
const { sendOTPSMS } = require("../utils/sendSMS");
const generateOTP = require("../utils/generateOTP");
const mongoose = require("mongoose");
// const Razorpay = require('razorpay');


// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

const router = express.Router();
const loggedInUsers = new Set();

// Ensure uploads directory exists
const notesDir = path.join(__dirname, '..', 'uploads', 'notes');
if (!fs.existsSync(notesDir)) fs.mkdirSync(notesDir, { recursive: true });

const blockedTypes = ['video/', 'audio/'];

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/notes/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const isBlocked = blockedTypes.some(type => file.mimetype.startsWith(type));
  if (isBlocked) {
    return cb(new Error('Video and audio files are not allowed'), false);
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter });

router.post("/register", async (req, res) => {
  const { name, email, password, phone } = req.body;

  try {
    // Check if email already exists
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(400).json({ message: "Email or phone already registered" });
    }

    const otp = generateOTP();

    if (email) await sendOTPEmail(email, otp);
    if (phone) await sendOTPSMS(phone, otp);

    await Otp.create({ email, phone, code: otp, password, name });

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    res.status(500).json({ message: "OTP failed", error: err.message });
  }
});

router.post("/send-otp", async (req, res) => {
  const { email, phone } = req.body;
  try {
    const otp = generateOTP();
    if (email) await sendOTPEmail(email, otp);
    if (phone) await sendOTPSMS(phone, otp);

    await Otp.create({ email, phone, code: otp });

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to send OTP", error: err.message });
  }
});

router.post("/verify-otp", async (req, res) => {
  const { email, phone, otp } = req.body;

  if (!otp || (!email && !phone)) {
    return res.status(400).json({ message: "OTP and email or phone required" });
  }

  const query = email ? { email, code: otp } : { phone, code: otp };
  const found = await Otp.findOne(query);
  if (!found) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  res.status(200).json({ message: "OTP verified successfully" });
});


router.post("/set-username", async (req, res) => {
  const { username, email, phone } = req.body;

  if (!username || (!email && !phone)) {
    return res.status(400).json({ message: "Username and email or phone required" });
  }

  try {
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const query = email ? { email } : { phone };
    const otpRecord = await Otp.findOne(query);
    if (!otpRecord) {
      return res.status(400).json(); //{ message: "No registration data found. Please start again." }
    }

    const hashedPassword = await bcrypt.hash(otpRecord.password, 10);
    const newUser = new User({
      name: otpRecord.name,
      email: otpRecord.email,
      phone: otpRecord.phone,
      password: hashedPassword,
      username: username,
    });

    await newUser.save();
    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(201).json({ message: "Registration complete", user: newUser });

  } catch (err) {
    res.status(500).json({ message: "Username setup failed", error: err.message });
  }
});


router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json('User not found');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json('Invalid credentials');

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

router.post("/upload", upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), async (req, res) => {
  try {
    const filePath = req.files?.file?.[0]?.path?.replace(/\\/g, '/');
    const imagePath = req.files?.image?.[0]?.path?.replace(/\\/g, '/');
    const price = parseInt(req.body.price || 0);

    if (!filePath) return res.status(400).json({ error: "At least one file is required." });
    if (price !== 0 && (price < 1 || price > 100)) {
      return res.status(400).json({ error: "Price must be 0 (free) or between 1 and 100." });
      }

    const userId = req.body.uploader;
    const userNotes = await Note.find({ uploader: userId });
    const totalNotes = userNotes.length;
    const freeNotes = userNotes.filter(n => n.price === 0).length;

    if (price === 0 && (freeNotes >= 2 || totalNotes >= 10 && freeNotes >= Math.floor(totalNotes / 5))) {
      return res.status(400).json({ error: "You can only upload 2 free notes out of every 10." });
    }

    const newNote = new Note({
      title: req.body.title,
      subject: req.body.subject,
      uploader: req.body.uploader,
      image: imagePath || '',
      fileUrl: filePath,
      price: price
    });

    await newNote.save();
    res.status(200).json(newNote);
  } catch (error) {
    res.status(500).json({ error: error.message || "Upload failed." });
  }
});

// Views
router.post('/view/:id', async (req, res) => {
  try {
    const note = await Note.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );
    res.status(200).json(note);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update views' });
  }
});

// Home 
router.get("/", async (req, res) => {
  try {
    const latestNotes = await Note.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("uploader", "username profilePicture");

    const popularNotes = await Note.find()
      .sort({ views: -1 })
      .limit(5)
      .populate("uploader", "username profilePicture");

    res.status(200).json({
      latest: latestNotes,
      popular: popularNotes,
      loggedInUsers: Array.from(loggedInUsers), // ✅ Include logged in usernames
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load homepage data." });
  }
});

router.get("/home/:userId", async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);

    const latestNote = await Note.find({ uploader: userId })
      .sort({ createdAt: -1 })
      .limit(1);

    const popularNote = await Note.find({ uploader: userId })
      .sort({ views: -1 })
      .limit(1);

    res.status(200).json({
      latest: latestNote,
      popular: popularNote,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load user home data", error: error.message });
  }
});

// Download Note and Increment Download Count
// Route: GET /api/user/download/:id?userId=abc123

router.get("/download/:id", async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    // 👇 Skip increment if uploader is same as downloader
    const requestingUserId = req.query.userId;
    if (requestingUserId && requestingUserId !== String(note.uploader)) {
      await Note.findByIdAndUpdate(req.params.id, {
        $inc: { downloads: 1 },
      });
    }

    const filePath = path.resolve(__dirname, '..', note.fileUrl);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    res.download(filePath, path.basename(filePath));
  } catch (err) {
    res.status(500).json({ message: "Download failed", error: err.message });
  }
});



router.get("/notes", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit
    const [notes, total] = await Promise.all([
      Note.find().sort({ createdAt: -1 }).skip(skip).limit(limit).select('-file').populate("uploader", "username profilePicture"),Note.countDocuments()]);
      res.status(200).json({
      notes,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalNotes: total
    });
  } catch (err) {
    console.error("❌ Error in /notes:", err);
    res.status(500).json({ message: "Failed to fetch notes" });
  }
});


router.get("/notes/:id", async (req, res) => {
  try {
    const userId = req.query.userId;

    const note = await Note.findById(req.params.id).populate("uploader", "username profilePicture");

    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }

    const uploaderId = note.uploader?._id?.toString() || note.uploader?.toString();

    if (userId && uploaderId && userId !== uploaderId) {
      await Note.findByIdAndUpdate(note._id, { $inc: { views: 1 } });
      note.views += 1; // reflect increment in response
    }

    res.status(200).json(note);
  } catch (err) {
    console.error("❌ Error fetching note:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// Count notes + total views and downloads uploaded by user
router.get('/notes/stats/:userId', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId); // 👈 Convert string to ObjectId

    const notes = await Note.find({ uploader: userId });

    const count = notes.length;
    const views = notes.reduce((acc, note) => acc + (note.views || 0), 0);
    const downloads = notes.reduce((acc, note) => acc + (note.downloads || 0), 0);

    res.status(200).json({ count, views, downloads });
  } catch (err) {
    res.status(500).json({ message: "Failed to get note stats", error: err.message });
  }
});


// Get all notes by a user, including total views and downloads
router.get("/notes/user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const notes = await Note.find({ uploader: userId }).sort({ createdAt: -1 });

    const totalViews = notes.reduce((acc, note) => acc + (note.views || 0), 0);
    const totalDownloads = notes.reduce((acc, note) => acc + (note.downloads || 0), 0);

    res.status(200).json({
      notes,
      totalViews,
      totalDownloads,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user notes", error: err.message });
  }
});

// Buy Note Route
// router.post("/notes/:noteId/buy", async (req, res) => {
//   const { userId } = req.body; // buyer's ID
//   const { noteId } = req.params;

//   try {
//     const note = await Note.findById(noteId).populate("uploader");
//     const buyer = await User.findById(userId);
//     const uploader = note.uploader;
//     const admin = await User.findOne({ isAdmin: true });

//     if (!note || !buyer || !uploader || !admin) {
//       return res.status(404).json({ message: "Invalid user or note." });
//     }

//     // If note is free
//     if (note.price === 0) {
//       return res.status(400).json({ message: "This note is already free." });
//     }

//     // Check if already purchased
//     if (buyer.purchasedNotes.includes(noteId)) {
//       return res.status(400).json({ message: "You already purchased this note." });
//     }

//     // Check if user has enough balance
//     if (buyer.wallet < note.price) {
//       return res.status(400).json({ message: "Insufficient wallet balance." });
//     }

//     // Deduct from buyer
//     buyer.wallet -= note.price;
//     buyer.purchasedNotes.push(noteId);

//     // Calculate shares
//     const uploaderShare = note.price * 0.9;
//     const adminShare = note.price * 0.1;

//     // Add to uploader and admin
//     uploader.wallet += uploaderShare;
//     admin.wallet += adminShare;

//     await buyer.save();
//     await uploader.save();
//     await admin.save();

//     return res.status(200).json({ message: "Note purchased successfully." });

//   } catch (err) {
//     console.error("Buy Error:", err);
//     return res.status(500).json({ error: err.message || "Something went wrong." });
//   }
// });

module.exports = router;



module.exports = router;
