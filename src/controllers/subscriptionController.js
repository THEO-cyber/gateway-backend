const Subscription = require("../models/Subscription");
const User = require("../models/User");
const Course = require("../models/Course");
const nkwaPayService = require("../services/nkwaPayService");

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
  daily: {
    name: "Daily Access",
    price: 100,
    duration: "1 day",
    features: ["All Courses", "All Tests", "Course Materials"],
    description: "Full access to all courses for 1 day",
  },
  weekly: {
    name: "Weekly Plan",
    price: 500,
    duration: "1 week",
    features: ["All Courses", "All Tests", "Course Materials"],
    description: "Full access to all courses for 1 week",
  },
  monthly: {
    name: "Monthly Plan",
    price: 1500,
    duration: "1 month",
    features: ["All Courses", "All Tests", "Course Materials"],
    description: "Full access to all courses for 1 month",
  },
  four_month: {
    name: "4-Month Plan",
    price: 4000,
    duration: "4 months",
    features: ["All Courses", "All Tests", "Course Materials"],
    description: "Full access to all courses for 4 months",
  },
  ai_monthly: {
    name: "AI Monthly Plan",
    price: 500,
    duration: "1 month",
    features: ["Unlimited AI Usage", "AI Study Assistant"],
    description: "Unlimited AI access for 1 month",
  },
};

// Get all subscription plans
exports.getPlans = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      plans: SUBSCRIPTION_PLANS,
      message: "Subscription plans retrieved successfully",
    });
  } catch (error) {
    // Log error securely
    if (process.env.NODE_ENV === 'development') {
      console.error("[SubscriptionController] Error getting plans:", error);
    }
    res.status(500).json({
      success: false,
      message: "Failed to get subscription plans",
      error: error.message,
    });
  }
};

// Subscribe to a plan
exports.subscribe = async (req, res) => {
  try {
    let { planType, courseId, phoneNumber, phone, amount } = req.body;
    const userId = req.user.id;

    // Handle both phone and phoneNumber fields
    if (!phoneNumber && phone) {
      phoneNumber = phone;
    }

    // Backward compatibility: convert per_course to daily
    if (planType === "per_course") {
      planType = "daily";
      console.log(
        "[SubscriptionController] Converting per_course to daily for backward compatibility",
      );
    }

    console.log("[SubscriptionController] Subscribe request:", {
      planType,
      courseId,
      userId,
      originalBody: req.body,
    });

    // Validate phone number
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Validate plan type
    if (!SUBSCRIPTION_PLANS[planType]) {
      console.error("[SubscriptionController] Invalid plan type:", planType);
      console.error(
        "[SubscriptionController] Available plans:",
        Object.keys(SUBSCRIPTION_PLANS),
      );
      return res.status(400).json({
        success: false,
        message: `Invalid subscription plan. Available plans: ${Object.keys(SUBSCRIPTION_PLANS).join(", ")}`,
        availablePlans: Object.keys(SUBSCRIPTION_PLANS),
        receivedPlan: req.body.planType,
      });
    }

    // Check for existing active subscription of same type
    const existingSubscription = await Subscription.findOne({
      userId,
      planType,
      status: "active",
      endDate: { $gt: new Date() },
    });

    if (existingSubscription) {
      return res.status(409).json({
        success: false,
        message: "You already have an active subscription of this type",
        subscription: existingSubscription,
      });
    }

    const plan = SUBSCRIPTION_PLANS[planType];

    // Validate amount matches plan price
    if (amount && amount !== plan.price) {
      console.warn(
        `[SubscriptionController] Amount mismatch: received ${amount}, expected ${plan.price} for ${planType}`,
      );
      return res.status(400).json({
        success: false,
        message: `Invalid amount. Expected ${plan.price} for ${plan.name}, received ${amount}`,
        expectedAmount: plan.price,
        planDetails: plan,
      });
    }
    const transactionId =
      `SUB_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`.toUpperCase();

    // Create subscription record (endDate will be set by pre-save middleware)
    const subscription = new Subscription({
      userId,
      planType,
      courserId: courseId || null,
      amount: plan.price,
      transactionId,
      status: "pending",
      // Don't include endDate - let the pre-save middleware calculate it
      metadata: {
        planDetails: plan.name,
        // Only include course name if courseId is provided
        ...(courseId && {
          courseName: (await Course.findById(courseId))?.name,
        }),
      },
    });

    await subscription.save();

    // Initiate payment via Nkwa Pay
    const paymentResult = await nkwaPayService.initiateSubscriptionPayment(
      userId,
      req.user.email,
      phoneNumber,
      plan.price,
      `Subscription: ${plan.name}`,
      transactionId,
      subscription._id,
    );

    if (paymentResult.success) {
      res.status(201).json({
        success: true,
        subscription: subscription,
        payment: paymentResult,
        message:
          "Subscription initiated successfully. Complete payment on your phone.",
      });
    } else {
      // Delete the subscription if payment initiation failed
      await Subscription.findByIdAndDelete(subscription._id);
      res.status(400).json({
        success: false,
        message: "Failed to initiate payment",
        error: paymentResult.message,
      });
    }
  } catch (error) {
    // Log error securely
    if (process.env.NODE_ENV === 'development') {
      console.error("[SubscriptionController] Error subscribing:", error);
    }
    res.status(500).json({
      success: false,
      message: "Failed to create subscription",
      error: error.message,
    });
  }
};

// Get user's subscriptions
exports.getUserSubscriptions = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscriptions = await Subscription.find({ userId })
      .populate("courserId", "name description")
      .sort({ createdAt: -1 });

    const activeSubscriptions = subscriptions.filter(
      (sub) => sub.status === "active" && sub.endDate > new Date(),
    );

    res.status(200).json({
      success: true,
      subscriptions: {
        all: subscriptions,
        active: activeSubscriptions,
        count: {
          total: subscriptions.length,
          active: activeSubscriptions.length,
        },
      },
      message: "Subscriptions retrieved successfully",
    });
  } catch (error) {
    console.error(
      "[SubscriptionController] Error getting subscriptions:",
      error,
    );
    res.status(500).json({
      success: false,
      message: "Failed to get subscriptions",
      error: error.message,
    });
  }
};

// Check subscription status for a specific service
exports.checkAccess = async (req, res) => {
  try {
    const { service, courseId } = req.query;
    const userId = req.user.id;

    const user = await User.findById(userId);
    await user.updateSubscriptionStatus();

    let hasAccess = false;
    let details = {};

    switch (service) {
      case "courses":
      case "tests":
        hasAccess = user.hasAccessTo(service);
        if (courseId) {
          // Check specific course access
          const courseSubscription = await Subscription.findOne({
            userId,
            courserId: courseId,
            status: "active",
            endDate: { $gt: new Date() },
          });
          hasAccess = hasAccess || !!courseSubscription;
        }
        break;

      case "ai":
        hasAccess = user.hasAccessTo("ai");
        details = {
          tokensUsed: user.aiTokens.used,
          tokenLimit: user.aiTokens.limit,
          unlimited: user.accessLevel.unlimited,
        };
        break;
    }

    res.status(200).json({
      success: true,
      hasAccess,
      service,
      details,
      message: hasAccess
        ? `Access granted to ${service}`
        : `Access denied to ${service}. Please subscribe.`,
    });
  } catch (error) {
    // Log error securely
    if (process.env.NODE_ENV === 'development') {
      console.error("[SubscriptionController] Error checking access:", error);
    }
    res.status(500).json({
      success: false,
      message: "Failed to check access",
      error: error.message,
    });
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user.id;

    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      userId,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (subscription.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Subscription is already cancelled",
      });
    }

    subscription.status = "cancelled";
    await subscription.save();

    // Update user's access levels
    const user = await User.findById(userId);
    await user.updateSubscriptionStatus();

    res.status(200).json({
      success: true,
      subscription,
      message: "Subscription cancelled successfully",
    });
  } catch (error) {
    console.error(
      "[SubscriptionController] Error cancelling subscription:",
      error,
    );
    res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
      error: error.message,
    });
  }
};

// Admin: Get all subscriptions
exports.getAllSubscriptions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, planType } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (planType) filter.planType = planType;

    const subscriptions = await Subscription.find(filter)
      .populate("userId", "firstName lastName email")
      .populate("courserId", "name")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Subscription.countDocuments(filter);

    res.status(200).json({
      success: true,
      subscriptions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
      },
      message: "All subscriptions retrieved successfully",
    });
  } catch (error) {
    console.error(
      "[SubscriptionController] Error getting all subscriptions:",
      error,
    );
    res.status(500).json({
      success: false,
      message: "Failed to get subscriptions",
      error: error.message,
    });
  }
};

// Process subscription webhook (for payment confirmation)
exports.processSubscriptionWebhook = async (
  subscriptionId,
  paymentStatus,
  paymentData,
) => {
  try {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    if (paymentStatus === "completed") {
      subscription.status = "active";
      subscription.paymentId = paymentData.paymentId;
      await subscription.save();

      // Update user's subscription status
      const user = await User.findById(subscription.userId);
      await user.updateSubscriptionStatus();

      console.log(
        `[SubscriptionController] Subscription ${subscriptionId} activated successfully`,
      );
    } else if (paymentStatus === "failed") {
      subscription.status = "cancelled";
      await subscription.save();

      console.log(
        `[SubscriptionController] Subscription ${subscriptionId} cancelled due to payment failure`,
      );
    }

    return { success: true, subscription };
  } catch (error) {
    console.error(
      "[SubscriptionController] Error processing subscription webhook:",
      error,
    );
    return { success: false, error: error.message };
  }
};

// Admin: Get subscription details with user info
exports.getSubscriptionDetails = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    const subscription = await Subscription.findById(subscriptionId)
      .populate("userId", "name email phone")
      .populate("paymentId");

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    res.json({
      success: true,
      subscription: subscription,
    });
  } catch (error) {
    // Log error securely
    if (process.env.NODE_ENV === 'development') {
      console.error("Error fetching subscription details:", error);
    }
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Admin: Update subscription status
exports.updateSubscriptionStatus = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { status, adminNote } = req.body;

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    const oldStatus = subscription.status;
    subscription.status = status;
    subscription.adminNote = adminNote;
    subscription.lastModifiedBy = req.user.id;
    subscription.lastModifiedAt = new Date();

    await subscription.save();

    // Update user's subscription status
    const user = await User.findById(subscription.userId);
    if (user) {
      await user.updateSubscriptionStatus();
    }

    console.log(
      `Subscription ${subscriptionId} status updated from ${oldStatus} to ${status} by admin ${req.user.email}`,
    );

    res.json({
      success: true,
      message: "Subscription status updated successfully",
      subscription: subscription,
    });
  } catch (error) {
    // Log error securely
    if (process.env.NODE_ENV === 'development') {
      console.error("Error updating subscription status:", error);
    }
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Admin: Get subscription stats
exports.getSubscriptionStats = async (req, res) => {
  try {
    const { timeRange = "30d" } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const [stats, recentSubscriptions] = await Promise.all([
      Subscription.aggregate([
        {
          $facet: {
            totalActive: [
              { $match: { status: "active" } },
              { $count: "count" },
            ],
            totalCancelled: [
              { $match: { status: "cancelled" } },
              { $count: "count" },
            ],
            totalExpired: [
              { $match: { status: "expired" } },
              { $count: "count" },
            ],
            recentSubscriptions: [
              { $match: { createdAt: { $gte: startDate } } },
              { $count: "count" },
            ],
            planDistribution: [
              { $group: { _id: "$planType", count: { $sum: 1 } } },
            ],
            revenue: [
              {
                $match: {
                  status: { $in: ["active", "expired"] },
                  createdAt: { $gte: startDate },
                },
              },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ],
          },
        },
      ]),
      Subscription.find({ createdAt: { $gte: startDate } })
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    const result = {
      totalActive: stats[0].totalActive[0]?.count || 0,
      totalCancelled: stats[0].totalCancelled[0]?.count || 0,
      totalExpired: stats[0].totalExpired[0]?.count || 0,
      recentSubscriptions: stats[0].recentSubscriptions[0]?.count || 0,
      planDistribution: stats[0].planDistribution,
      revenue: stats[0].revenue[0]?.total || 0,
      recentSubscriptionsList: recentSubscriptions,
      timeRange,
    };

    res.json({
      success: true,
      stats: result,
    });
  } catch (error) {
    // Log error securely
    if (process.env.NODE_ENV === 'development') {
      console.error("Error fetching subscription stats:", error);
    }
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
