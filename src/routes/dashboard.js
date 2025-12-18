const express = require("express");
const router = express.Router();
const {
  getOverallStats,
  getActiveUsers,
  getPopularCourses,
  getRecentActivity,
  getDownloadStats,
} = require("../controllers/dashboardController");
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/adminAuth");

// All dashboard routes require admin authentication
router.use(protect);
router.use(isAdmin);

router.get("/stats", getOverallStats);
router.get("/active-users", getActiveUsers);
router.get("/popular-courses", getPopularCourses);
router.get("/recent-activity", getRecentActivity);
router.get("/download-stats", getDownloadStats);

module.exports = router;
