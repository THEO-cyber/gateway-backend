// src/services/nkwaPayService.js
const axios = require("axios");
const crypto = require("crypto");
const Payment = require("../models/Payment");

const NKWAPAY_BASE_URL =
  process.env.NKWAPAY_BASE_URL || "https://api.pay.staging.mynkwa.com";
const NKWAPAY_API_KEY = process.env.NKWAPAY_API_KEY;
const NKWAPAY_WEBHOOK_SECRET = process.env.NKWAPAY_WEBHOOK_SECRET;
// Legacy payment fee removed - now using subscription-based pricing
// const PAYMENT_FEE = parseInt(process.env.PAYMENT_FEE) || 1000;

const SUCCESS_STATUSES = new Set([
  "successful",
  "completed",
  "success",
  "succeeded",
  "paid",
]);

const FAILURE_STATUSES = new Set([
  "failed",
  "cancelled",
  "canceled",
  "declined",
  "error",
]);

function normalizeStatus(status) {
  if (!status) return "";
  return String(status).trim().toLowerCase();
}

function getWebhookField(payload, ...paths) {
  for (const path of paths) {
    const value = path
      .split(".")
      .reduce(
        (acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined),
        payload,
      );
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

// Generate unique transaction ID
function generateTransactionId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `HND_${timestamp}_${random}`.toUpperCase();
}

// Format phone number for Cameroon
function formatPhoneNumber(phone) {
  // Check if phone is null, undefined, or empty
  if (!phone || typeof phone !== "string") {
    throw new Error("Phone number is required and must be a valid string");
  }

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

// DEPRECATED: Legacy payment function - Use subscription system instead
async function initiateNkwaPayment({
  phoneNumber,
  userId = null,
  userEmail = null,
  purpose = "registration_fee",
  description = "HND Gateway Registration Fee",
}) {
  console.warn(
    "[NkwaPayService] DEPRECATED: Legacy payment function called. Use subscription system instead.",
  );

  throw new Error(
    "Legacy payments are no longer supported. Please use the subscription system with plans starting at 75 XAF. " +
      "Available plans: Per Course (75 XAF), Weekly (200 XAF), Monthly (500 XAF), 4-Month (1500 XAF)",
  );
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

    // Check status with Nkwa Pay (provider ID preferred, merchant reference fallback)
    const statusLookupId = payment.nkwaTransactionId || transactionId;

    if (statusLookupId) {
      const response = await axios.get(
        `${NKWAPAY_BASE_URL}/payments/${statusLookupId}`,
        {
          headers: { "X-API-KEY": NKWAPAY_API_KEY },
          timeout: 10000,
        },
      );

      const responseData = response.data || {};
      const nestedData = responseData.data || {};

      // Update payment status based on Nkwa Pay response
      const nkwaStatus =
        responseData.status ||
        nestedData.status ||
        responseData.paymentStatus ||
        nestedData.paymentStatus;
      const normalizedStatus = normalizeStatus(nkwaStatus);

      const returnedTransactionId =
        responseData.transactionId ||
        responseData.id ||
        nestedData.transactionId ||
        nestedData.id;

      if (!payment.nkwaTransactionId && returnedTransactionId) {
        payment.nkwaTransactionId = returnedTransactionId;
      }

      let newStatus = payment.status;

      if (SUCCESS_STATUSES.has(normalizedStatus)) {
        newStatus = "success";
        payment.completedAt = new Date();
      } else if (FAILURE_STATUSES.has(normalizedStatus)) {
        newStatus = "failed";
        payment.completedAt = new Date();
        payment.errorMessage =
          responseData.message || nestedData.message || "Payment failed";
      }

      if (newStatus !== payment.status) {
        payment.status = newStatus;
        await payment.save();
      } else if (!payment.nkwaTransactionId && returnedTransactionId) {
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
      const providedSignature = String(signature)
        .replace(/^sha256=/i, "")
        .trim();
      const expectedSignature = crypto
        .createHmac("sha256", NKWAPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest("hex");

      if (providedSignature !== expectedSignature) {
        throw new Error("Invalid webhook signature");
      }
    }

    const reference = getWebhookField(
      payload,
      "reference",
      "data.reference",
      "data.metadata.reference",
      "metadata.reference",
      "merchantReference",
      "externalReference",
    );
    const transactionId = getWebhookField(
      payload,
      "transactionId",
      "id",
      "data.transactionId",
      "data.id",
      "paymentId",
    );
    const rawStatus = getWebhookField(
      payload,
      "status",
      "data.status",
      "paymentStatus",
    );
    const normalizedStatus = normalizeStatus(rawStatus);

    if (!reference && !transactionId) {
      throw new Error("Missing payment reference/transaction ID in webhook");
    }

    // Find payment by our transaction ID (reference) first, then provider ID fallback
    let payment = null;
    if (reference) {
      payment = await Payment.findByTransactionId(reference);
    }
    if (!payment && transactionId) {
      payment = await Payment.findOne({ nkwaTransactionId: transactionId });
    }

    if (!payment) {
      console.warn(
        `[NkwaPayService] Webhook received for unknown payment: ${reference || transactionId}`,
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
    if (SUCCESS_STATUSES.has(normalizedStatus)) {
      await payment.markAsSuccessful(payload);
      console.log(
        `[NkwaPayService] Payment successful: ${payment.transactionId}`,
      );
    } else if (FAILURE_STATUSES.has(normalizedStatus)) {
      await payment.markAsFailed(
        payload.message || "Payment failed",
        normalizedStatus,
      );
      console.log(`[NkwaPayService] Payment failed: ${payment.transactionId}`);
    } else {
      // Update status but don't mark as completed
      payment.status = "processing";
      await payment.save();
      console.log(
        `[NkwaPayService] Payment status updated: ${payment.transactionId} - ${rawStatus}`,
      );
    }

    return {
      success: true,
      transactionId: payment.transactionId,
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

// Initiate subscription payment
async function initiateSubscriptionPayment(
  userId,
  userEmail,
  phoneNumber,
  amount,
  description,
  transactionId,
  subscriptionId,
) {
  try {
    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Create payment record in database
    const payment = new Payment({
      transactionId,
      amount,
      phoneNumber: formattedPhone,
      userId,
      userEmail,
      purpose: "subscription",
      description,
      status: "pending",
      metadata: {
        subscriptionId: subscriptionId.toString(),
        isSubscriptionPayment: true,
      },
    });

    await payment.save();

    console.log(
      `[NkwaPayService] Created subscription payment record: ${transactionId}`,
    );

    // Prepare payment request
    const paymentData = {
      amount,
      phoneNumber: formattedPhone,
      reference: transactionId,
      description: description,
      webhookUrl: process.env.WEBHOOK_URL || null,
    };

    console.log(`[NkwaPayService] Initiating subscription payment:`, {
      transactionId,
      amount,
      phone: formattedPhone.substring(0, 6) + "XXX", // Masked for security
      subscriptionId,
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
      `[NkwaPayService] Subscription payment initiated successfully: ${transactionId}`,
    );

    return {
      success: true,
      transactionId,
      nkwaTransactionId: payment.nkwaTransactionId,
      amount,
      phoneNumber: formattedPhone,
      status: "processing",
      message:
        "Subscription payment request sent. Please check your phone for the payment prompt.",
      data: response.data,
    };
  } catch (err) {
    console.error(
      "[NkwaPayService] Error initiating subscription payment:",
      err.message,
    );

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
        "[NkwaPayService] Error updating failed subscription payment:",
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
        `Subscription payment failed: ${err.response.data?.message || "Unknown error from payment provider"}`,
      );
    } else if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
      throw new Error(
        "Payment service is temporarily unavailable. Please try again later.",
      );
    } else {
      throw new Error(
        `Subscription payment initialization failed: ${err.message}`,
      );
    }
  }
}

module.exports = {
  initiateNkwaPayment,
  initiateSubscriptionPayment,
  checkPaymentStatus,
  processWebhook,
  getAllPayments,
  // PAYMENT_FEE removed - using subscription plans
};
