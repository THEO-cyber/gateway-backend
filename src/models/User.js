const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  firstName: {
    type: String,
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
  },
  role: {
    type: String,
    enum: ["student", "admin"],
    default: "student",
  },
  department: {
    type: String,
    trim: true,
  },
  yearOfStudy: {
    type: String,
    trim: true,
  },
  bio: {
    type: String,
    trim: true,
  },
  avatar: {
    type: String,
    default: "",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isBanned: {
    type: Boolean,
    default: false,
  },
  
  // Payment related fields
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'exempt'],
    default: 'pending'
  },
  paymentDate: {
    type: Date
  },
  paymentAmount: {
    type: Number
  },
  paymentTransactionId: {
    type: String
  },
  
  resetPasswordOTP: String,
  resetPasswordExpire: Date,
  resetPasswordAttempts: {
    type: Number,
    default: 0,
  },
  resetPasswordCooldown: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);
