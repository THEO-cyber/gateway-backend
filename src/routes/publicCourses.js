const express = require("express");
const router = express.Router();
const Course = require("../models/Course");
const { protect } = require("../middleware/auth");
const {
  requireCourseAccess,
  updateSubscriptionStatus,
} = require("../middleware/subscriptionAuth");

// Apply authentication middleware
router.use(protect);
router.use(updateSubscriptionStatus);

/**
 * @route GET /api/courses/public
 * @desc Get all courses for students (requires subscription for details)
 * @access Private (Authenticated users)
 */
router.get("/public", async (req, res) => {
  try {
    // Always show basic course list
    const courses = await Course.find()
      .populate("department", "name code")
      .select("name code department description credits")
      .sort({ name: 1 });

    res.json({
      success: true,
      data: courses,
      message: "Subscribe to access course content and tests",
    });
  } catch (error) {
    console.error("[CoursesRoute] Error fetching courses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch courses",
      error: error.message,
    });
  }
});

/**
 * @route GET /api/courses/public/:id
 * @desc Get specific course details (requires subscription)
 * @access Private (Requires course subscription)
 */
router.get("/public/:id", requireCourseAccess, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("department", "name code")
      .populate("subjects", "name description");

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.json({
      success: true,
      data: course,
      message: "Course access granted",
    });
  } catch (error) {
    console.error("[CoursesRoute] Error fetching course details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch course details",
      error: error.message,
    });
  }
});

/**
 * @route POST /api/courses/public/:id/enroll
 * @desc Enroll in a course (requires subscription)
 * @access Private (Authenticated users)
 */
router.post("/public/:id/enroll", async (req, res) => {
  try {
    const courseId = req.params.id;
    const userId = req.user.id;

    const User = require("../models/User");
    const Subscription = require("../models/Subscription");

    // Update user subscription status
    const user = await User.findById(userId);
    await user.updateSubscriptionStatus();

    // Check if user has access to this course
    const hasGeneralAccess = user.hasAccessTo("courses");
    const hasCourseAccess = await Subscription.findOne({
      userId,
      courserId: courseId,
      status: "active",
      endDate: { $gt: new Date() },
    });

    if (!hasGeneralAccess && !hasCourseAccess) {
      return res.status(403).json({
        success: false,
        message: "Course enrollment requires subscription",
        requiresPayment: true,
        courseId,
        availablePlans: [
          {
            type: "per_course",
            price: 75,
            description: "Access this course for 6 months",
          },
          {
            type: "weekly",
            price: 200,
            description: "Access all courses for 1 week",
          },
          {
            type: "monthly",
            price: 500,
            description: "Access all courses for 1 month",
          },
          {
            type: "four_month",
            price: 1500,
            description: "Access all courses for 4 months",
          },
        ],
      });
    }

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // User has access - enrollment successful
    res.json({
      success: true,
      message: `Successfully enrolled in ${course.name}`,
      data: {
        courseId,
        courseName: course.name,
        enrolledAt: new Date(),
        accessLevel: hasGeneralAccess ? "full" : "course_specific",
      },
    });
  } catch (error) {
    console.error("[CoursesRoute] Error enrolling in course:", error);
    res.status(500).json({
      success: false,
      message: "Failed to enroll in course",
      error: error.message,
    });
  }
});

module.exports = router;
