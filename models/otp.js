const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: String,
  phone: String,
  code: String,
  name: String,
  password: String, // plain text for now; hashed when saving User
  createdAt: { type: Date, default: Date.now, expires: 300 }, // 5 mins
});

module.exports = mongoose.model("Otp", otpSchema);
