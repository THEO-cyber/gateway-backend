const {
  initiateNkwaPayment,
  checkPaymentStatus,
  processWebhook,
  getAllPayments,
  // PAYMENT_FEE removed - using subscription plans
} = require("../services/nkwaPayService");
const Payment = require("../models/Payment");
const User = require("../models/User");
const logger = require("../utils/logger");
const { processSubscriptionWebhook } = require("./subscriptionController");

const TERMINAL_SUCCESS = new Set([
  "success",
  "successful",
  "completed",
  "paid",
  "succeeded",
]);
const TERMINAL_FAILURE = new Set(["failed", "cancelled", "canceled", "error"]);

const normalizePaymentStatus = (status) =>
  status ? String(status).trim().toLowerCase() : "";

const mapToInternalStatus = (status) => {
  const normalized = normalizePaymentStatus(status);
  if (TERMINAL_SUCCESS.has(normalized)) return "success";
  if (TERMINAL_FAILURE.has(normalized)) return "failed";
  return normalized || "processing";
};

const syncPaymentEntitlements = async (payment, statusOverride = null) => {
  if (!payment || !payment.userId) return;

  const internalStatus = mapToInternalStatus(statusOverride || payment.status);

  if (
    payment.metadata &&
    payment.metadata.isSubscriptionPayment &&
    payment.metadata.subscriptionId
  ) {
    const subscriptionStatus =
      internalStatus === "success" ? "completed" : "failed";

    if (internalStatus === "success" || internalStatus === "failed") {
      await processSubscriptionWebhook(
        payment.metadata.subscriptionId,
        subscriptionStatus,
        {
          paymentId: payment._id,
          transactionId: payment.transactionId,
          amount: payment.amount,
        },
      );
    }

    return;
  }

  if (internalStatus === "success") {
    const user = await User.findById(payment.userId);
    if (user && user.paymentStatus !== "completed") {
      user.paymentStatus = "completed";
      user.paymentDate = new Date();
      user.paymentAmount = payment.amount;
      user.paymentTransactionId = payment.transactionId;
      await user.save();
    }
  }
};

const reconcilePendingPayments = async ({ limit = 50, userId = null } = {}) => {
  const query = {
    status: { $in: ["pending", "processing"] },
  };

  if (userId) {
    query.userId = userId;
  }

  const pendingPayments = await Payment.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("transactionId");

  for (const pendingPayment of pendingPayments) {
    try {
      const result = await checkPaymentStatus(pendingPayment.transactionId);
      const refreshedPayment = await Payment.findByTransactionId(
        pendingPayment.transactionId,
      );

      if (refreshedPayment) {
        await syncPaymentEntitlements(refreshedPayment, result.status);
      }
    } catch (error) {
      logger.warn(
        `[PaymentController] Reconciliation failed for ${pendingPayment.transactionId}: ${error.message}`,
      );
    }
  }
};

// Initiate payment
exports.initiatePayment = async (req, res) => {
  try {
    res.status(410).json({
      success: false,
      message:
        "Legacy payments are no longer supported. Please use the subscription system for better value and flexibility.",
      deprecated: true,
      redirectTo: "/api/subscriptions",
      availablePlans: [
        {
          type: "daily",
          price: 100,
          description: "Access specific course for 1 day",
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
        {
          type: "ai_monthly",
          price: 500,
          description: "Unlimited AI access for 1 month",
        },
      ],
      migration: {
        note: "The old 1000 XAF fee has been replaced with flexible subscription plans starting at 75 XAF",
        benefit:
          "You now get better value and can choose plans that fit your needs",
      },
    });
  } catch (error) {
    console.error(
      "[PaymentController] Error in deprecated payment endpoint:",
      error.message,
    );

    res.status(500).json({
      success: false,
      message:
        "Payment system has been migrated to subscriptions. Please use /api/subscriptions instead.",
      error: error.message,
    });
  }
};

// Check payment status
exports.checkStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.userId;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required",
      });
    }

    // Verify the payment belongs to the user
    const payment = await Payment.findOne({
      transactionId,
      userId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found or doesn't belong to you",
      });
    }

    const result = await checkPaymentStatus(transactionId);

    const refreshedPayment = await Payment.findOne({ transactionId, userId });
    if (refreshedPayment) {
      await syncPaymentEntitlements(refreshedPayment, result.status);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    // Log error securely
    if (process.env.NODE_ENV === "development") {
      console.error("[PaymentController] Status check failed:", error.message);
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to check payment status",
    });
  }
};

// Handle webhook
exports.handleWebhook = async (req, res) => {
  try {
    const signature =
      req.headers["x-signature"] || req.headers["x-nkwa-signature"];
    const payload = req.body;

    console.log("[PaymentController] Webhook received:", {
      signature: signature ? "present" : "missing",
      reference: payload.reference,
      status: payload.status,
    });

    const result = await processWebhook(payload, signature);

    if (result.success) {
      const payment = await Payment.findByTransactionId(result.transactionId);
      if (payment) {
        await syncPaymentEntitlements(payment, result.status);
      }

      res
        .status(200)
        .json({ success: true, message: "Webhook processed successfully" });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error(
      "[PaymentController] Webhook processing failed:",
      error.message,
    );

    // Still return 200 to prevent retries for invalid webhooks
    res.status(200).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

// Get current fee (deprecated - redirects to subscription plans)
exports.getFee = (req, res) => {
  res.json({
    success: false,
    message: "Legacy payment fee has been replaced with subscription plans",
    redirectTo: "/api/subscriptions/plans",
    subscriptionPlans: {
      per_course: {
        amount: 75,
        currency: "XAF",
        description: "Per course access for 6 months",
      },
      weekly: {
        amount: 200,
        currency: "XAF",
        description: "All courses for 1 week",
      },
      monthly: {
        amount: 500,
        currency: "XAF",
        description: "All courses for 1 month",
      },
      four_month: {
        amount: 1500,
        currency: "XAF",
        description: "All courses for 4 months",
      },
      ai_monthly: {
        amount: 500,
        currency: "XAF",
        description: "Unlimited AI for 1 month",
      },
    },
  });
};

// Get user payment history
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await getAllPayments(page, limit, { userId });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "[PaymentController] Failed to fetch payment history:",
      error.message,
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
    });
  }
};

// Admin: Get all payments
exports.getAllPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const phoneNumber = req.query.phone;
    const userId = req.query.userId;

    const filters = {};
    if (status) filters.status = status;
    if (phoneNumber) filters.phoneNumber = phoneNumber;
    if (userId) filters.userId = userId;

    // Keep admin dashboard accurate by reconciling pending/processing payments first
    await reconcilePendingPayments({ limit: Math.max(limit, 20) });

    const result = await getAllPayments(page, limit, filters);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "[PaymentController] Admin: Failed to fetch payments:",
      error.message,
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
    });
  }
};

// Admin: Get payment statistics
exports.getStats = async (req, res) => {
  try {
    // Refresh a batch of pending records so stats don't remain stale
    await reconcilePendingPayments({ limit: 100 });

    const stats = await Payment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const totalPayments = await Payment.countDocuments();
    const totalRevenue = await Payment.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayPayments = await Payment.countDocuments({
      createdAt: { $gte: todayStart },
    });

    const successfulPayments = await Payment.countDocuments({
      status: "success",
    });

    const pendingPayments = await Payment.countDocuments({
      status: { $in: ["pending", "processing"] },
    });

    // Get recent payments
    const recentPayments = await Payment.find()
      .populate("userId", "username email firstName lastName")
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        byStatus: stats,
        totalPayments,
        successfulPayments,
        pendingPayments,
        totalRevenue: totalRevenue[0]?.total || 0,
        todayPayments,
        paymentSystem: "subscription-based",
        recentPayments: recentPayments.map((p) => ({
          transactionId: p.transactionId,
          amount: p.amount,
          status: p.status,
          phoneNumber: p.phoneNumber,
          user: p.userId
            ? {
                username: p.userId.username,
                email: p.userId.email,
                name: `${p.userId.firstName || ""} ${p.userId.lastName || ""}`.trim(),
              }
            : null,
          createdAt: p.createdAt,
          completedAt: p.completedAt,
        })),
      },
    });
  } catch (error) {
    console.error(
      "[PaymentController] Admin: Failed to fetch stats:",
      error.message,
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch payment statistics",
    });
  }
};

// Admin: Retry failed payment webhook
exports.retryWebhook = async (req, res) => {
  try {
    const { transactionId, paymentId } = req.params;

    let resolvedTransactionId = transactionId;

    if (!resolvedTransactionId && paymentId) {
      const paymentById =
        await Payment.findById(paymentId).select("transactionId");
      if (paymentById) {
        resolvedTransactionId = paymentById.transactionId;
      }
    }

    if (!resolvedTransactionId) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID or valid payment ID is required",
      });
    }

    const payment = await Payment.findByTransactionId(resolvedTransactionId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Check payment status with Nkwa Pay
    const result = await checkPaymentStatus(resolvedTransactionId);
    const refreshedPayment = await Payment.findByTransactionId(
      resolvedTransactionId,
    );
    if (refreshedPayment) {
      await syncPaymentEntitlements(refreshedPayment, result.status);
    }

    res.json({
      success: true,
      message: "Payment status updated",
      data: result,
    });
  } catch (error) {
    console.error(
      "[PaymentController] Admin: Failed to retry webhook:",
      error.message,
    );

    res.status(500).json({
      success: false,
      message: "Failed to retry webhook",
    });
  }
};

// Admin: Update payment status manually
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status, adminNote } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const oldStatus = payment.status;
    payment.status = status;
    payment.adminNote = adminNote;
    payment.lastModifiedBy = req.user.id;
    payment.lastModifiedAt = new Date();

    await payment.save();

    logger.info(
      `Payment ${paymentId} status updated from ${oldStatus} to ${status} by admin ${req.user.email}`,
    );

    res.json({
      success: true,
      message: "Payment status updated successfully",
      payment: payment,
    });
  } catch (error) {
    logger.error(`Error updating payment status: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Admin: Get payment details with user info
exports.getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId)
      .populate("userId", "name email phone")
      .populate("subscriptionId");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.json({
      success: true,
      payment: payment,
    });
  } catch (error) {
    logger.error(`Error fetching payment details: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Admin: Refund payment
exports.refundPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason, refundAmount } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status === "refunded") {
      return res.status(400).json({
        success: false,
        message: "Payment already refunded",
      });
    }

    payment.status = "refunded";
    payment.refundReason = reason;
    payment.refundAmount = refundAmount || payment.amount;
    payment.refundedBy = req.user.id;
    payment.refundedAt = new Date();

    await payment.save();

    // If payment had a subscription, deactivate it
    if (payment.subscriptionId) {
      const Subscription = require("../models/Subscription");
      await Subscription.findByIdAndUpdate(payment.subscriptionId, {
        status: "cancelled",
        cancelledBy: req.user.id,
        cancelledAt: new Date(),
        cancellationReason: `Payment refunded: ${reason}`,
      });
    }

    logger.info(
      `Payment ${paymentId} refunded by admin ${req.user.email}. Reason: ${reason}`,
    );

    res.json({
      success: true,
      message: "Payment refunded successfully",
      payment: payment,
    });
  } catch (error) {
    logger.error(`Error refunding payment: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Paper Download Payment Functions
exports.initiatePaperDownloadPayment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Check if user already has active subscription
    const user = await User.findById(userId).select('paperDownloadSubscriptionExpiryDate');
    if (user?.paperDownloadSubscriptionExpiryDate && user.paperDownloadSubscriptionExpiryDate > new Date()) {
      return res.status(400).json({
        success: false,
        message: "You already have an active paper download subscription",
        expiryDate: user.paperDownloadSubscriptionExpiryDate,
      });
    }

    const amount = parseInt(process.env.PAPER_DOWNLOAD_FEE) || 1000;
    const subscriptionMonths = parseInt(process.env.PAPER_DOWNLOAD_SUBSCRIPTION_MONTHS) || 9;

    // Initiate payment with paper download metadata
    const payment = await initiateNkwaPayment({
      userId,
      phoneNumber,
      amount,
      description: `Paper Download Subscription - ${subscriptionMonths} months unlimited access`,
      metadata: {
        type: 'paper_download_subscription',
        subscriptionMonths,
      }
    });

    res.json({
      success: true,
      message: "Paper download subscription payment initiated",
      data: payment,
    });
  } catch (error) {
    console.error("[PaymentController] Paper download payment failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to initiate paper download payment",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.checkPaperDownloadPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.userId;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required",
      });
    }

    // Verify the payment belongs to the user and is for paper download
    const payment = await Payment.findOne({
      transactionId,
      userId,
      'metadata.type': 'paper_download_subscription'
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Paper download payment not found",
      });
    }

    const result = await checkPaymentStatus(transactionId);
    
    // If payment is successful, activate subscription
    if (result.status === 'success' || result.status === 'completed') {
      const subscriptionMonths = payment.metadata?.subscriptionMonths || 9;
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + subscriptionMonths);

      await User.findByIdAndUpdate(userId, {
        paperDownloadSubscriptionExpiryDate: expiryDate,
      });

      // Update payment status
      await Payment.findOneAndUpdate(
        { transactionId },
        { 
          status: 'success',
          completedAt: new Date(),
        }
      );

      return res.json({
        success: true,
        message: "Paper download subscription activated successfully",
        data: {
          ...result,
          subscriptionActive: true,
          expiryDate,
        },
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[PaymentController] Paper download status check failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to check paper download payment status",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  initiatePayment: exports.initiatePayment,
  checkStatus: exports.checkStatus,
  handleWebhook: exports.handleWebhook,
  getFee: exports.getFee,
  getHistory: exports.getHistory,
  getAllPayments: exports.getAllPayments,
  getStats: exports.getStats,
  retryWebhook: exports.retryWebhook,
  // Admin functions
  updatePaymentStatus: exports.updatePaymentStatus,
  getPaymentDetails: exports.getPaymentDetails,
  refundPayment: exports.refundPayment,
  // Paper download functions
  initiatePaperDownloadPayment: exports.initiatePaperDownloadPayment,
  checkPaperDownloadPaymentStatus: exports.checkPaperDownloadPaymentStatus,
};
