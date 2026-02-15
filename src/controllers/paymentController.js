const {
  initiateNkwaPayment,
  checkPaymentStatus,
  processWebhook,
  getAllPayments,
  PAYMENT_FEE,
} = require("../services/nkwaPayService");
const Payment = require("../models/Payment");
const User = require("../models/User");

// Initiate payment
exports.initiatePayment = async (req, res) => {
  try {
    const { phone, purpose = "registration_fee", description } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
      });
    }

    const userId = req.user.userId;
    const userEmail = req.user.email;

    // Check if user has pending payments
    const pendingPayment = await Payment.findOne({
      userId,
      status: { $in: ["pending", "processing"] },
    }).sort({ createdAt: -1 });

    if (pendingPayment) {
      // Check if pending payment is older than 10 minutes, if so, mark as failed
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      if (pendingPayment.createdAt < tenMinutesAgo) {
        await pendingPayment.markAsFailed("Payment timeout", "timeout");
      } else {
        return res.status(400).json({
          success: false,
          message:
            "You have a pending payment. Please complete it or wait for it to expire before initiating a new one.",
          data: {
            transactionId: pendingPayment.transactionId,
            amount: pendingPayment.amount,
            createdAt: pendingPayment.createdAt,
          },
        });
      }
    }

    console.log(
      `[PaymentController] Initiating payment for user: ${userId} (${userEmail})`,
    );

    const result = await initiateNkwaPayment({
      phoneNumber: phone,
      userId,
      userEmail,
      purpose,
      description: description || `HND Gateway ${purpose.replace("_", " ")}`,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error(
      "[PaymentController] Payment initiation failed:",
      error.message,
    );

    res.status(500).json({
      success: false,
      message: error.message || "Payment initiation failed.",
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

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[PaymentController] Status check failed:", error.message);

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
      // If payment was successful, update user's payment status
      if (result.status === "success") {
        const payment = await Payment.findByTransactionId(result.transactionId);
        if (payment && payment.userId) {
          const user = await User.findById(payment.userId);
          if (user && !user.paymentStatus) {
            user.paymentStatus = "completed";
            user.paymentDate = new Date();
            user.paymentAmount = payment.amount;
            await user.save();

            console.log(
              `[PaymentController] Updated user payment status: ${user._id}`,
            );
          }
        }
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

// Get current fee
exports.getFee = (req, res) => {
  res.json({
    success: true,
    data: {
      amount: PAYMENT_FEE,
      currency: "XAF",
      formattedAmount: `${PAYMENT_FEE.toLocaleString()} FCFA`,
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
        paymentFee: PAYMENT_FEE,
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
    const { transactionId } = req.params;

    const payment = await Payment.findByTransactionId(transactionId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Check payment status with Nkwa Pay
    const result = await checkPaymentStatus(transactionId);

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

module.exports = {
  initiatePayment: exports.initiatePayment,
  checkStatus: exports.checkStatus,
  handleWebhook: exports.handleWebhook,
  getFee: exports.getFee,
  getHistory: exports.getHistory,
  getAllPayments: exports.getAllPayments,
  getStats: exports.getStats,
  retryWebhook: exports.retryWebhook,
};
