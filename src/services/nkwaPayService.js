// src/services/nkwaPayService.js
const axios = require("axios");
const crypto = require("crypto");
const Payment = require("../models/Payment");

const NKWAPAY_BASE_URL =
  process.env.NKWAPAY_BASE_URL || "https://api.pay.staging.mynkwa.com";
const NKWAPAY_API_KEY = process.env.NKWAPAY_API_KEY;
const NKWAPAY_WEBHOOK_SECRET = process.env.NKWAPAY_WEBHOOK_SECRET;
const PAYMENT_FEE = parseInt(process.env.PAYMENT_FEE) || 1000;

// Generate unique transaction ID
function generateTransactionId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `HND_${timestamp}_${random}`.toUpperCase();
}

// Format phone number for Cameroon
function formatPhoneNumber(phone) {
  // Remove any non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // If it starts with 6, add 237
  if (cleaned.startsWith("6") && cleaned.length === 9) {
    cleaned = "237" + cleaned;
  }

  // If it starts with 2376 or 2377, it's already formatted
  if (cleaned.startsWith("237") && cleaned.length === 12) {
    return cleaned;
  }

  throw new Error(
    "Invalid phone number format. Expected Cameroon number starting with 6XXXXXXXX or 237XXXXXXXXX",
  );
}

async function initiateNkwaPayment({
  phoneNumber,
  userId = null,
  userEmail = null,
  purpose = "registration_fee",
  description = "HND Gateway Registration Fee",
}) {
  if (!NKWAPAY_API_KEY) {
    console.error("[NkwaPayService] Nkwa Pay API key not set");
    throw new Error("Payment service configuration error");
  }

  try {
    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Generate unique transaction ID
    const transactionId = generateTransactionId();

    // Create payment record in database
    const payment = new Payment({
      transactionId,
      amount: PAYMENT_FEE,
      phoneNumber: formattedPhone,
      userId,
      userEmail,
      purpose,
      description,
      status: "pending",
    });

    await payment.save();

    console.log(`[NkwaPayService] Created payment record: ${transactionId}`);

    // Prepare payment request
    const paymentData = {
      amount: PAYMENT_FEE,
      phoneNumber: formattedPhone,
      reference: transactionId,
      description: description,
      webhookUrl: process.env.WEBHOOK_URL || null,
    };

    console.log(`[NkwaPayService] Initiating payment:`, {
      transactionId,
      amount: PAYMENT_FEE,
      phone: formattedPhone.substring(0, 6) + "XXX", // Masked for security
    });

    // Debug configuration
    console.log(`[NkwaPayService] Using URL: ${NKWAPAY_BASE_URL}/collect`);
    console.log(
      `[NkwaPayService] Using API Key: ${NKWAPAY_API_KEY ? NKWAPAY_API_KEY.substring(0, 5) + "..." : "NOT SET"}`,
    );

    // Make API call to Nkwa Pay
    const response = await axios.post(
      `${NKWAPAY_BASE_URL}/collect`,
      paymentData,
      {
        headers: {
          "X-API-KEY": NKWAPAY_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 seconds timeout
      },
    );

    // Update payment record with Nkwa Pay response
    payment.nkwaPayResponse = response.data;
    payment.nkwaTransactionId = response.data.transactionId || response.data.id;
    payment.status = "processing";
    await payment.save();

    console.log(
      `[NkwaPayService] Payment initiated successfully: ${transactionId}`,
    );

    return {
      success: true,
      transactionId,
      nkwaTransactionId: payment.nkwaTransactionId,
      amount: PAYMENT_FEE,
      phoneNumber: formattedPhone,
      status: "processing",
      message:
        "Payment request sent. Please check your phone for the payment prompt.",
      data: response.data,
    };
  } catch (err) {
    console.error("[NkwaPayService] Error initiating payment:", err.message);

    // Update payment record if it exists
    try {
      const failedPayment = await Payment.findOne({ transactionId }).sort({
        createdAt: -1,
      });
      if (failedPayment && failedPayment.status === "pending") {
        await failedPayment.markAsFailed(
          err.message,
          err.response?.status?.toString(),
        );
      }
    } catch (updateError) {
      console.error(
        "[NkwaPayService] Error updating failed payment:",
        updateError.message,
      );
    }

    if (err.response) {
      console.error("[NkwaPayService] Nkwa Pay API error:", {
        status: err.response.status,
        data: err.response.data,
        headers: err.response.headers,
      });

      throw new Error(
        `Payment failed: ${err.response.data?.message || "Unknown error from payment provider"}`,
      );
    } else if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
      throw new Error(
        "Payment service is temporarily unavailable. Please try again later.",
      );
    } else {
      throw new Error(`Payment initialization failed: ${err.message}`);
    }
  }
}

// Check payment status
async function checkPaymentStatus(transactionId) {
  try {
    const payment = await Payment.findByTransactionId(transactionId);
    if (!payment) {
      throw new Error("Payment not found");
    }

    // If payment is already completed, return current status
    if (["success", "failed", "refunded"].includes(payment.status)) {
      return {
        transactionId,
        status: payment.status,
        amount: payment.amount,
        phoneNumber: payment.phoneNumber,
        completedAt: payment.completedAt,
        webhookReceived: payment.webhookReceived,
      };
    }

    // Check status with Nkwa Pay if we have their transaction ID
    if (payment.nkwaTransactionId) {
      const response = await axios.get(
        `${NKWAPAY_BASE_URL}/payments/${payment.nkwaTransactionId}`,
        {
          headers: { "X-API-KEY": NKWAPAY_API_KEY },
          timeout: 10000,
        },
      );

      // Update payment status based on Nkwa Pay response
      const nkwaStatus = response.data.status;
      let newStatus = payment.status;

      if (nkwaStatus === "successful" || nkwaStatus === "completed") {
        newStatus = "success";
        payment.completedAt = new Date();
      } else if (nkwaStatus === "failed" || nkwaStatus === "cancelled") {
        newStatus = "failed";
        payment.completedAt = new Date();
        payment.errorMessage = response.data.message || "Payment failed";
      }

      if (newStatus !== payment.status) {
        payment.status = newStatus;
        await payment.save();
      }
    }

    return {
      transactionId,
      status: payment.status,
      amount: payment.amount,
      phoneNumber: payment.phoneNumber,
      completedAt: payment.completedAt,
      webhookReceived: payment.webhookReceived,
    };
  } catch (err) {
    console.error(
      `[NkwaPayService] Error checking payment status: ${err.message}`,
    );
    if (err.response) {
      console.error("[NkwaPayService] Nkwa Pay API error:", err.response.data);
    }
    throw err;
  }
}

// Process webhook from Nkwa Pay
async function processWebhook(payload, signature) {
  try {
    // Verify webhook signature if secret is configured
    if (NKWAPAY_WEBHOOK_SECRET && signature) {
      const expectedSignature = crypto
        .createHmac("sha256", NKWAPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest("hex");

      if (signature !== expectedSignature) {
        throw new Error("Invalid webhook signature");
      }
    }

    const { reference, status, transactionId, amount, phoneNumber } = payload;

    if (!reference) {
      throw new Error("Missing transaction reference in webhook");
    }

    // Find payment by our transaction ID (reference)
    const payment = await Payment.findByTransactionId(reference);
    if (!payment) {
      console.warn(
        `[NkwaPayService] Webhook received for unknown payment: ${reference}`,
      );
      return { success: false, message: "Payment not found" };
    }

    // Update payment with webhook data
    payment.webhookData = payload;
    payment.webhookReceived = true;
    payment.webhookAttempts += 1;

    // Update Nkwa transaction ID if not set
    if (!payment.nkwaTransactionId && transactionId) {
      payment.nkwaTransactionId = transactionId;
    }

    // Update payment status based on webhook
    if (status === "successful" || status === "completed") {
      await payment.markAsSuccessful(payload);
      console.log(`[NkwaPayService] Payment successful: ${reference}`);
    } else if (status === "failed" || status === "cancelled") {
      await payment.markAsFailed(payload.message || "Payment failed", status);
      console.log(`[NkwaPayService] Payment failed: ${reference}`);
    } else {
      // Update status but don't mark as completed
      payment.status = "processing";
      await payment.save();
      console.log(
        `[NkwaPayService] Payment status updated: ${reference} - ${status}`,
      );
    }

    return {
      success: true,
      transactionId: reference,
      status: payment.status,
    };
  } catch (err) {
    console.error("[NkwaPayService] Webhook processing error:", err.message);
    throw err;
  }
}

// Get all payments (for admin)
async function getAllPayments(page = 1, limit = 20, filters = {}) {
  try {
    const query = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.phoneNumber) {
      query.phoneNumber = { $regex: filters.phoneNumber, $options: "i" };
    }

    const skip = (page - 1) * limit;

    const payments = await Payment.find(query)
      .populate("userId", "username email firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments(query);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (err) {
    console.error("[NkwaPayService] Error fetching payments:", err.message);
    throw err;
  }
}

module.exports = {
  initiateNkwaPayment,
  checkPaymentStatus,
  processWebhook,
  getAllPayments,
  PAYMENT_FEE,
};
