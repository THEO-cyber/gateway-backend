const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  getUserDetails,
  updateUser,
  deleteUser,
  bulkDeleteUsers,
  exportUsers,
  getUserStats,
  getPendingPapers,
  deleteAnyQuestion,
  deleteAnyAnswer,
  getPopularPapers,
  getActiveUsers,
  getUserStatsForDashboard,
  getPapersStats,
  getQaStats,
  getDownloadsStats,
  getAnnouncementsStats,
  getCoursesStats,
} = require("../controllers/adminController");
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/adminAuth");

// All admin routes require authentication and admin role
router.use(protect);
router.use(isAdmin);

// Dashboard statistics
router.get("/stats", getDashboardStats);

// Statistics endpoints for admin dashboard
router.get("/users/stats", getUserStatsForDashboard);
router.get("/papers/stats", getPapersStats);
router.get("/qa/stats", getQaStats);
router.get("/downloads/stats", getDownloadsStats);
router.get("/announcements/stats", getAnnouncementsStats);
router.get("/courses/stats", getCoursesStats);

// User management
router.get("/users", getAllUsers);
router.get("/users/:id", getUserDetails);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// Content moderation
router.get("/papers/pending", getPendingPapers);
router.delete("/questions/:id", deleteAnyQuestion);
router.delete("/answers/:questionId/:answerId", deleteAnyAnswer);

// Reports
router.get("/reports/popular-papers", getPopularPapers);
router.get("/reports/active-users", getActiveUsers);

module.exports = router;
