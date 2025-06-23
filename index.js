const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

dotenv.config(); // Load .env

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads')); // to serve uploaded files

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const fileFilter = (req, file, cb) => {
  const disallowedTypes = [
    'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'
  ];

  if (disallowedTypes.includes(file.mimetype)) {
    return cb(new Error('File type not allowed (video or music).'), false);
  }
  cb(null, true);
};
const upload = multer({ storage });

// MongoDB connection
mongoose.connect("mongodb+srv://vivek48027:%40Manisharma11@cluster0.fi4rner.mongodb.net/crud", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("✅ MongoDB connected");
}).catch((err) => {
    console.error("❌ MongoDB connection error:", err);
});

// Routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/user', userRoutes);

app.use('/uploads', express.static('uploads'));

// Test route
app.get("/", (req, res) => {
    res.send("API running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
