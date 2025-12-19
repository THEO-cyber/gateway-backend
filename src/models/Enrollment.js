const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema({
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Test",
    required: true,
  },
  studentEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  studentName: {
    type: String,
    required: true,
    trim: true,
  },
  enrolledAt: {
    type: Date,
    default: Date.now,
  },
  submitted: {
    type: Boolean,
    default: false,
  },
});

enrollmentSchema.index({ testId: 1, studentEmail: 1 }, { unique: true });

module.exports = mongoose.model("Enrollment", enrollmentSchema);
