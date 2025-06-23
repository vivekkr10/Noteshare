// utils/sendOtp.js
const nodemailer = require("nodemailer");

const sendOTPEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,  // ✅ Your Gmail
      pass: process.env.EMAIL_PASS,  // ✅ App Password
    },
  });

  const mailOptions = {
    from: `"NoteShare" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your NoteShare OTP",
    html: `<p>Your OTP is: <strong>${otp}</strong></p>`,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail };
