const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema({
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
  answers: [
    {
      questionId: String,
      questionIndex: Number,
      selectedAnswer: String,
    },
  ],
  score: {
    type: Number,
    required: true,
  },
  totalQuestions: {
    type: Number,
    required: true,
  },
  percentage: {
    type: Number,
    required: true,
  },
  grade: {
    type: String,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  resultsReleased: {
    type: Boolean,
    default: false,
  },
  releasedAt: {
    type: Date,
  },
});

submissionSchema.index({ testId: 1, studentEmail: 1 }, { unique: true });
submissionSchema.index({ resultsReleased: 1 });

module.exports = mongoose.model("Submission", submissionSchema);
