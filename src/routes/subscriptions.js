const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/subscriptionController");
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/adminAuth");
const {
  updateSubscriptionStatus,
  checkExpiredSubscriptions,
} = require("../middleware/subscriptionAuth");
const {
  validateSubscription,
  validateObjectId,
  sanitizeInput,
} = require("../middleware/validation");

// Apply subscription status update middleware to all routes
router.use(protect);
router.use(sanitizeInput);
router.use(updateSubscriptionStatus);

// Public subscription routes
/**
 * @route GET /api/subscriptions/plans
 * @desc Get all available subscription plans
 * @access Private (Authenticated users)
 */
router.get("/plans", subscriptionController.getPlans);

/**
 * @route POST /api/subscriptions/subscribe
 * @desc Subscribe to a plan
 * @access Private (Authenticated users)
 * @body { planType, courseId?, phoneNumber }
 */
router.post("/subscribe", subscriptionController.subscribe);

/**
 * @route GET /api/subscriptions/my-subscriptions
 * @desc Get current user's subscriptions
 * @access Private (Authenticated users)
 */
router.get("/my-subscriptions", subscriptionController.getUserSubscriptions);

/**
 * @route GET /api/subscriptions/check-access
 * @desc Check access to a specific service
 * @access Private (Authenticated users)
 * @query { service, courseId? }
 */
router.get("/check-access", subscriptionController.checkAccess);

/**
 * @route PUT /api/subscriptions/:subscriptionId/cancel
 * @desc Cancel a subscription
 * @access Private (Authenticated users)
 */
router.put(
  "/:subscriptionId/cancel",
  subscriptionController.cancelSubscription,
);

// Admin routes
/**
 * @route GET /api/subscriptions/admin/all
 * @desc Get all subscriptions (Admin only)
 * @access Private (Admin only)
 * @query { page?, limit?, status?, planType? }
 */
router.get(
  "/admin/all",
  isAdmin,
  checkExpiredSubscriptions,
  subscriptionController.getAllSubscriptions,
);

/**
 * @route POST /api/subscriptions/admin/expire-check
 * @desc Manually check and expire old subscriptions
 * @access Private (Admin only)
 */
router.post("/admin/expire-check", isAdmin, async (req, res) => {
  try {
    const Subscription = require("../models/Subscription");
    const User = require("../models/User");

    // Expire old subscriptions
    const expiredResult = await Subscription.expireOldSubscriptions();

    // Reset AI tokens for users without unlimited access
    const tokenResetResult = await User.resetMonthlyAITokens();

    res.status(200).json({
      success: true,
      message: "Expiration check completed",
      results: {
        subscriptionsExpired: expiredResult.modifiedCount,
        tokensReset: tokenResetResult.modifiedCount,
      },
    });
  } catch (error) {
    console.error("[SubscriptionRoutes] Admin expire check error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check expirations",
      error: error.message,
    });
  }
});

module.exports = router;
