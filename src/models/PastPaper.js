const mongoose = require("mongoose");

const pastPaperSchema = new mongoose.Schema({
  department: {
    type: String,
    required: true,
    trim: true,
  },
  course: {
    type: String,
    required: true,
    trim: true,
  },
  year: {
    type: Number,
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  fileUrl: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  downloads: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for faster queries
pastPaperSchema.index({ department: 1, course: 1, year: 1 });
pastPaperSchema.index({ uploadedBy: 1 });

module.exports = mongoose.model("PastPaper", pastPaperSchema);
