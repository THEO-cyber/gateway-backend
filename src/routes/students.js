const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Submission = require("../models/Submission");

// @route   GET /api/students/profile
// @desc    Get student profile
// @access  Public (but requires email query param)
router.get("/profile", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const enrolledTests = await Enrollment.countDocuments({
      studentEmail: email,
    });

    const completedTests = await Submission.countDocuments({
      studentEmail: email,
    });

    res.json({
      success: true,
      data: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department,
        yearOfStudy: user.yearOfStudy,
        enrolledTests,
        completedTests,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: error.message,
    });
  }
});

module.exports = router;
