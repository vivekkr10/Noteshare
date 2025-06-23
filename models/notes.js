const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  image: { type: String, required: true },
  fileUrl: { type: String, required: true },
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  views: { type: Number, default: 0 },
  downloads: { type: Number, default: 0 },
  price: { type: Number, required: true }, // New field
}, { timestamps: true });

noteSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Note", noteSchema);