// Middleware to check if user has an active paper download subscription
const User = require("../models/User");

// Require active paper download subscription for downloads
exports.requirePaperDownloadPayment = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select(
      "paperDownloadPaymentStatus paperDownloadSubscriptionExpiryDate role"
    );
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }
    // Admins bypass payment
    if (user.role === "admin") return next();
    // Check for active subscription
    const hasValidSubscription =
      (user.paperDownloadPaymentStatus === "completed" ||
        user.paperDownloadPaymentStatus === "exempt") &&
      (!user.paperDownloadSubscriptionExpiryDate ||
        user.paperDownloadSubscriptionExpiryDate > new Date());
    if (hasValidSubscription) return next();
    // Expired or missing subscription
    return res.status(402).json({
      success: false,
      message: "Paper download subscription required",
      expired:
        user.paperDownloadPaymentStatus === "completed" &&
        user.paperDownloadSubscriptionExpiryDate &&
        user.paperDownloadSubscriptionExpiryDate <= new Date(),
      expiryDate: user.paperDownloadSubscriptionExpiryDate,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to check paper download subscription",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Allow view-only access for non-subscribers (browsing, searching, etc.)
exports.allowViewOnlyWithoutPayment = async (req, res, next) => {
  // No-op, just call next()
  return next();
};
