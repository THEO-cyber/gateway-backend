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
const {
  getAllPayments,
  getStats: getPaymentStats,
  retryWebhook,
  updatePaymentStatus,
  getPaymentDetails,
  refundPayment,
} = require("../controllers/paymentController");
const {
  getAllSubscriptions,
  getSubscriptionDetails,
  updateSubscriptionStatus,
  getSubscriptionStats,
} = require("../controllers/subscriptionController");
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

// === PAYMENT & SUBSCRIPTION MANAGEMENT ===

// Payment Management
router.get("/payments", getAllPayments);
router.get("/payments/stats", getPaymentStats);
router.get("/payments/:paymentId", getPaymentDetails);
router.put("/payments/:paymentId/status", updatePaymentStatus);
router.post("/payments/:paymentId/refund", refundPayment);
router.post("/payments/:paymentId/retry-webhook", retryWebhook);

// Subscription Management
router.get("/subscriptions", getAllSubscriptions);
router.get("/subscriptions/stats", getSubscriptionStats);
router.get("/subscriptions/:subscriptionId", getSubscriptionDetails);
router.put("/subscriptions/:subscriptionId/status", updateSubscriptionStatus);

module.exports = router;
