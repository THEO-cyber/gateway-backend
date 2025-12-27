const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getSimplifiedDashboardStats,
  getQuickStats,
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
  getRecentActivity,
} = require("../controllers/adminController");
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/adminAuth");
const {
  bulkUploadPapers,
  deletePaper,
} = require("../controllers/paperController");
const upload = require("../middleware/upload");

// All admin routes require authentication and admin role
router.use(protect);
router.use(isAdmin);

// Dashboard statistics (old detailed endpoint)
router.get("/stats", getDashboardStats);

// NEW: Simplified dashboard endpoints
router.get("/dashboard/stats", getSimplifiedDashboardStats);
router.get("/dashboard/quick-stats", getQuickStats);

// Statistics endpoints for admin dashboard (kept for backward compatibility)
router.get("/users/stats", getUserStatsForDashboard);
router.get("/papers/stats", getPapersStats);
router.get("/qa/stats", getQaStats);
router.get("/downloads/stats", getDownloadsStats);
router.get("/announcements/stats", getAnnouncementsStats);
router.get("/courses/stats", getCoursesStats);

// Activity endpoint (limit 5 by default)
router.get("/activity/recent", getRecentActivity);

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

// Paper upload (multiple files)
router.post("/papers/upload", upload.array("papers", 10), bulkUploadPapers);
// Paper delete (single file)
router.delete("/papers/:id", deletePaper);

module.exports = router;
