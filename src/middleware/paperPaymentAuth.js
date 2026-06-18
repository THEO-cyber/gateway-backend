const User = require("../models/User");

// Require active paper download subscription for downloads
exports.requirePaperDownloadPayment = async (req, res, next) => {
  try {
    const userId = req.user._id; // auth middleware sets _id, not userId
    const user = await User.findById(userId).select(
      "paperDownloadSubscriptionExpiryDate role"
    );

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    // Admins can always download
    if (user.role === "admin") return next();

    // Check if user has an active subscription (expiry date exists and is in the future)
    const now = new Date();
    const hasActiveSubscription =
      user.paperDownloadSubscriptionExpiryDate &&
      user.paperDownloadSubscriptionExpiryDate > now;

    if (hasActiveSubscription) return next();

    const isExpired =
      user.paperDownloadSubscriptionExpiryDate &&
      user.paperDownloadSubscriptionExpiryDate <= now;

    return res.status(402).json({
      success: false,
      message: isExpired
        ? "Your paper download subscription has expired. Please renew to continue downloading."
        : "Paper download subscription required. Please pay to download papers.",
      expired: isExpired,
      expiryDate: user.paperDownloadSubscriptionExpiryDate || null,
      paymentRequired: true,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to check paper download subscription",
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }
};

// Allow browsing/searching without subscription
exports.allowViewOnlyWithoutPayment = (req, res, next) => next();
