const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Submission = require("../models/Submission");
const { protect } = require("../middleware/auth");

// @route   GET /api/students/profile
// @desc    Get own student profile
// @access  Private
router.get("/profile", protect, async (req, res) => {
  try {
    const requestedEmail = req.query.email || req.user.email;

    // Students can only view their own profile; admins can view any
    if (req.user.role !== "admin" && requestedEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const user = await User.findOne({ email: requestedEmail }).select(
      "email firstName lastName department yearOfStudy createdAt"
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const [enrolledTests, completedTests] = await Promise.all([
      Enrollment.countDocuments({ studentEmail: requestedEmail }),
      Submission.countDocuments({ studentEmail: requestedEmail }),
    ]);

    const username = `${user.firstName || ""}${user.lastName ? " " + user.lastName : ""}`.trim();

    res.json({
      success: true,
      data: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username,
        department: user.department,
        yearOfStudy: user.yearOfStudy,
        enrolledTests,
        completedTests,
        savedPapers: [],
        createdAt: user.createdAt,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
});

module.exports = router;

