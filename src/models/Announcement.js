const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ["general", "urgent", "maintenance", "update", "event"],
    default: "general",
  },
  targetAudience: {
    type: String,
    enum: ["all", "students", "admins"],
    default: "all",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isPinned: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
  },
  viewCount: {
    type: Number,
    default: 0,
  },
  viewedBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ isActive: 1, isPinned: -1 });

module.exports = mongoose.model("Announcement", announcementSchema);
