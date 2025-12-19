const mongoose = require("mongoose");

const studyMaterialSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ["pdf", "video", "link"],
    required: true,
  },
  department: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  fileUrl: {
    type: String, // For PDFs
  },
  url: {
    type: String, // For videos/links
  },
  fileName: {
    type: String,
  },
  fileSize: {
    type: Number,
  },
  visible: {
    type: Boolean,
    default: true,
  },
  downloads: {
    type: Number,
    default: 0,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

studyMaterialSchema.index({ department: 1, visible: 1 });
studyMaterialSchema.index({ type: 1 });

module.exports = mongoose.model("StudyMaterial", studyMaterialSchema);
