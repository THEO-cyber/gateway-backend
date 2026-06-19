const axios = require("axios");
const crypto = require("crypto");
const Payment = require("../models/Payment");
const logger = require("../utils/logger");

const CAMPAY_BASE_URL =
  process.env.CAMPAY_BASE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://www.campay.net/api"
    : "https://demo.campay.net/api");

const CAMPAY_TOKEN = process.env.CAMPAY_TOKEN;
const CAMPAY_USERNAME = process.env.CAMPAY_USERNAME;
const CAMPAY_PASSWORD = process.env.CAMPAY_PASSWORD;
const CAMPAY_WEBHOOK_KEY = process.env.CAMPAY_WEBHOOK_KEY;

// CamPay returns SUCCESSFUL / FAILED / PENDING (uppercase)
const SUCCESS_STATUSES = new Set(["successful"]);
const FAILURE_STATUSES = new Set(["failed"]);

function normalizeStatus(status) {
  if (!status) return "";
  return String(status).trim().toLowerCase();
}

function formatPhoneNumber(phone) {
  if (!phone || typeof phone !== "string") {
    throw new Error("Phone number is required and must be a valid string");
  }
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("6") && cleaned.length === 9) {
    cleaned = "237" + cleaned;
  }
  if (cleaned.startsWith("237") && cleaned.length === 12) {
    return cleaned;
  }
  throw new Error(
    "Invalid phone number. Expected Cameroonian number starting with 6XXXXXXXX or 237XXXXXXXXX"
  );
}

// Return the permanent access token for the Authorization header.
// CamPay's /collect/ endpoint also requires username+password IN the body (see initiateSubscriptionPayment).
function getAuthHeader() {
  if (CAMPAY_TOKEN) return `Token ${CAMPAY_TOKEN}`;
  throw new Error("CAMPAY_TOKEN not configured in .env");
}

// Check payment status with CamPay and update our DB
async function checkPaymentStatus(transactionId) {
  try {
    const payment = await Payment.findByTransactionId(transactionId);
    if (!payment) throw new Error("Payment not found");

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

    // nkwaTransactionId is reused to store CamPay's reference
    const lookupRef = payment.nkwaTransactionId || transactionId;

    const response = await axios.get(
      `${CAMPAY_BASE_URL}/transaction/${lookupRef}/`,
      {
        headers: { Authorization: getAuthHeader() },
        timeout: 10000,
      }
    );

    const data = response.data;
    const normalizedStatus = normalizeStatus(data.status);

    let newStatus = payment.status;
    if (SUCCESS_STATUSES.has(normalizedStatus)) {
      newStatus = "success";
      payment.completedAt = new Date();
    } else if (FAILURE_STATUSES.has(normalizedStatus)) {
      newStatus = "failed";
      payment.completedAt = new Date();
      payment.errorMessage = data.reason || "Payment failed";
    }

    if (newStatus !== payment.status) {
      payment.status = newStatus;
      await payment.save();
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
    logger.error(`[CamPayService] Error checking payment status: ${err.message}`);
    if (err.response) {
      logger.error("[CamPayService] CamPay API error:", err.response.data);
    }
    throw err;
  }
}

// Process webhook from CamPay
async function processWebhook(payload, signature) {
  try {
    if (CAMPAY_WEBHOOK_KEY && signature) {
      const expectedSignature = crypto
        .createHmac("sha256", CAMPAY_WEBHOOK_KEY)
        .update(JSON.stringify(payload))
        .digest("hex");

      if (signature !== expectedSignature) {
        throw new Error("Invalid webhook signature");
      }
    }

    // CamPay sends external_reference (our transactionId) and reference (CamPay's ref)
    const externalReference = payload.external_reference;
    const campayReference = payload.reference;
    const rawStatus = payload.status;
    const normalizedStatus = normalizeStatus(rawStatus);

    if (!externalReference && !campayReference) {
      throw new Error("Missing reference in CamPay webhook payload");
    }

    let payment = null;
    if (externalReference) {
      payment = await Payment.findByTransactionId(externalReference);
    }
    if (!payment && campayReference) {
      payment = await Payment.findOne({ nkwaTransactionId: campayReference });
    }

    if (!payment) {
      logger.warn(
        `[CamPayService] Webhook for unknown payment: ${externalReference || campayReference}`
      );
      return { success: false, message: "Payment not found" };
    }

    payment.webhookData = payload;
    payment.webhookReceived = true;
    payment.webhookAttempts = (payment.webhookAttempts || 0) + 1;

    if (!payment.nkwaTransactionId && campayReference) {
      payment.nkwaTransactionId = campayReference;
    }

    if (SUCCESS_STATUSES.has(normalizedStatus)) {
      await payment.markAsSuccessful(payload);
      logger.info(`[CamPayService] Payment successful: ${payment.transactionId}`);
    } else if (FAILURE_STATUSES.has(normalizedStatus)) {
      await payment.markAsFailed(
        payload.reason || "Payment failed",
        normalizedStatus
      );
      logger.info(`[CamPayService] Payment failed: ${payment.transactionId}`);
    } else {
      payment.status = "processing";
      await payment.save();
      logger.info(
        `[CamPayService] Payment status updated: ${payment.transactionId} - ${rawStatus}`
      );
    }

    return {
      success: true,
      transactionId: payment.transactionId,
      status: payment.status,
    };
  } catch (err) {
    logger.error("[CamPayService] Webhook processing error:", err.message);
    throw err;
  }
}

// Get all payments for admin panel (same interface as nkwaPayService)
async function getAllPayments(page = 1, limit = 20, filters = {}) {
  try {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.userId) query.userId = filters.userId;
    if (filters.phoneNumber) {
      query.phoneNumber = { $regex: filters.phoneNumber, $options: "i" };
    }

    const skip = (page - 1) * limit;
    const payments = await Payment.find(query)
      .populate("userId", "email firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments(query);

    return {
      payments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  } catch (err) {
    logger.error("[CamPayService] Error fetching payments:", err.message);
    throw err;
  }
}

// Initiate subscription payment via CamPay
async function initiateSubscriptionPayment(
  userId,
  userEmail,
  phoneNumber,
  amount,
  description,
  transactionId,
  subscriptionId
) {
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);

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
        ...(subscriptionId
          ? {
              subscriptionId: subscriptionId.toString(),
              isSubscriptionPayment: true,
            }
          : {}),
      },
    });

    await payment.save();

    const paymentData = {
      amount: String(amount),
      currency: "XAF",
      from: formattedPhone,
      description,
      external_reference: transactionId,
      username: CAMPAY_USERNAME,
      password: CAMPAY_PASSWORD,
    };

    if (process.env.CAMPAY_WEBHOOK_URL) {
      paymentData.redirect_url = process.env.CAMPAY_WEBHOOK_URL;
    }

    logger.info(
      `[CamPayService] Initiating payment: ${transactionId}, amount: ${amount} XAF, phone: ${formattedPhone.substring(0, 6)}XXX`
    );

    const response = await axios.post(
      `${CAMPAY_BASE_URL}/collect/`,
      paymentData,
      {
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    // Store CamPay's reference in nkwaTransactionId for status lookups
    payment.nkwaTransactionId = response.data.reference;
    payment.nkwaPayResponse = response.data;
    payment.status = "processing";
    await payment.save();

    logger.info(
      `[CamPayService] Payment initiated: ${transactionId}, CamPay ref: ${response.data.reference}`
    );

    return {
      success: true,
      transactionId,
      campayReference: response.data.reference,
      amount,
      phoneNumber: formattedPhone,
      status: "processing",
      message:
        "Payment request sent. Please check your phone for the USSD prompt.",
      data: response.data,
    };
  } catch (err) {
    logger.error(
      `[CamPayService] Error initiating payment: ${err.message}`
    );

    try {
      const failedPayment = await Payment.findOne({ transactionId }).sort({
        createdAt: -1,
      });
      if (failedPayment && failedPayment.status === "pending") {
        await failedPayment.markAsFailed(
          err.message,
          err.response?.status?.toString()
        );
      }
    } catch (updateError) {
      logger.error(
        "[CamPayService] Error updating failed payment:",
        updateError.message
      );
    }

    if (err.response) {
      logger.error("[CamPayService] CamPay API error:", {
        status: err.response.status,
        data: err.response.data,
      });
      throw new Error(
        `Payment failed: ${
          err.response.data?.message ||
          err.response.data?.detail ||
          JSON.stringify(err.response.data) ||
          "Unknown error from payment provider"
        }`
      );
    } else if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
      throw new Error(
        "Payment service is temporarily unavailable. Please try again later."
      );
    } else {
      throw new Error(`Payment initialization failed: ${err.message}`);
    }
  }
}

module.exports = {
  initiateSubscriptionPayment,
  checkPaymentStatus,
  processWebhook,
  getAllPayments,
};
