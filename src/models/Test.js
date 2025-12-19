const mongoose = require("mongoose");

const testSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  department: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: Date,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  duration: {
    type: Number, // minutes
    required: true,
  },
  passingPercentage: {
    type: Number,
    default: 50,
  },
  description: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ["draft", "scheduled", "active", "completed"],
    default: "draft",
  },
  questions: [
    {
      question: {
        type: String,
        required: true,
      },
      options: {
        A: String,
        B: String,
        C: String,
        D: String,
      },
      correctAnswer: {
        type: String,
        enum: ["A", "B", "C", "D"],
        required: true,
      },
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
  completedAt: {
    type: Date,
  },
});

testSchema.index({ department: 1, status: 1 });
testSchema.index({ date: 1 });

module.exports = mongoose.model("Test", testSchema);
