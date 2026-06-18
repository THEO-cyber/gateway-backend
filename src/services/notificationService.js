/**
 * Push notification service using Firebase Cloud Messaging HTTP v1 API.
 * Uses google-auth-library (already installed) instead of firebase-admin,
 * which avoids Node.js 22 native-module compatibility issues.
 */
const { GoogleAuth } = require("google-auth-library");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

let googleAuth = null;
let projectId = null;
let fcmConfigured = false;

const loadServiceAccount = () => {
  // Option 1 – JSON file path (most reliable for local dev)
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (filePath) {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    if (fs.existsSync(resolved)) {
      try {
        const sa = JSON.parse(fs.readFileSync(resolved, "utf8"));
        logger.info(`[FCM] Loaded service account from ${resolved}`);
        return sa;
      } catch (e) {
        logger.warn(`[FCM] Failed to parse service account file: ${e.message}`);
      }
    } else {
      logger.warn(`[FCM] Service account file not found: ${resolved}`);
    }
  }

  // Option 2 – individual env vars (production / CI)
  const pid = process.env.FIREBASE_PROJECT_ID;
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = process.env.FIREBASE_PRIVATE_KEY;

  if (pid && pid !== "your-firebase-project-id" && email && key) {
    return {
      type: "service_account",
      project_id: pid,
      client_email: email,
      private_key: key.replace(/\\n/g, "\n").replace(/^["']|["']$/g, ""),
    };
  }

  return null;
};

const initFCM = () => {
  try {
    const sa = loadServiceAccount();
    if (!sa) {
      logger.warn("⚠️  Firebase FCM not configured — push notifications disabled.");
      logger.warn("    Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY");
      return;
    }

    projectId = sa.project_id;
    googleAuth = new GoogleAuth({ credentials: sa, scopes: [FCM_SCOPE] });
    fcmConfigured = true;
    logger.info(`✅ Firebase FCM ready (project: ${projectId})`);
  } catch (error) {
    logger.error(`❌ Firebase FCM init failed: ${error.message}`);
  }
};

initFCM();

// ── Core send function ────────────────────────────────────────────────────────

const getAccessToken = async () => {
  const client = await googleAuth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
};

/**
 * Send a push notification to one FCM token.
 * Returns true on success.
 */
const sendToToken = async (token, { title, body, data = {}, imageUrl } = {}) => {
  const accessToken = await getAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message = {
    token,
    notification: { title, body, ...(imageUrl ? { image: imageUrl } : {}) },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    android: { priority: "high", notification: { sound: "default", click_action: "FLUTTER_NOTIFICATION_CLICK" } },
    apns: { payload: { aps: { sound: "default", badge: 1 } } },
  };

  await axios.post(url, { message }, {
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    timeout: 10000,
  });

  return true;
};

/**
 * Send to multiple tokens, returning { successCount, failureCount, invalidTokens }.
 */
const sendToTokens = async (tokens, notification) => {
  if (!fcmConfigured) {
    logger.warn("[FCM] Skipping push — FCM not configured");
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const unique = [...new Set(tokens.filter(Boolean))];
  if (!unique.length) return { successCount: 0, failureCount: 0, invalidTokens: [] };

  let successCount = 0;
  let failureCount = 0;
  const invalidTokens = [];

  await Promise.allSettled(
    unique.map(async (token) => {
      try {
        await sendToToken(token, notification);
        successCount++;
      } catch (err) {
        failureCount++;
        const code = err?.response?.data?.error?.status;
        if (code === "INVALID_ARGUMENT" || code === "NOT_FOUND") {
          invalidTokens.push(token);
        }
        logger.warn(`[FCM] Token send failed: ${err?.response?.data?.error?.message || err.message}`);
      }
    })
  );

  logger.info(`[FCM] Sent ${successCount}/${unique.length} notifications`);
  return { successCount, failureCount, invalidTokens };
};

// ── User-level helpers ────────────────────────────────────────────────────────

const User = () => require("../models/User");

const notifyUser = async (userId, notification) => {
  try {
    const user = await User().findById(userId).select("+fcmTokens");
    if (!user?.fcmTokens?.length) return;

    const result = await sendToTokens(user.fcmTokens, notification);

    if (result.invalidTokens.length) {
      await User().findByIdAndUpdate(userId, {
        $pull: { fcmTokens: { $in: result.invalidTokens } },
      });
    }
  } catch (error) {
    logger.error(`[FCM] notifyUser ${userId} failed: ${error.message}`);
  }
};

const notifyUsers = async (userIds, notification) => {
  await Promise.allSettled(userIds.map((id) => notifyUser(id, notification)));
};

// ── Predefined notification builders ─────────────────────────────────────────

const notifications = {
  paymentSuccess: (planName, expiryDate) => ({
    title: "Payment Confirmed ✓",
    body: `Your ${planName} is now active${expiryDate ? ` until ${new Date(expiryDate).toLocaleDateString()}` : ""}.`,
    data: { type: "payment_success", planName },
  }),

  subscriptionExpiringSoon: (daysLeft) => ({
    title: "Subscription Expiring Soon",
    body: `Your subscription expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Renew to keep access.`,
    data: { type: "subscription_expiry_warning", daysLeft: String(daysLeft) },
  }),

  subscriptionExpired: () => ({
    title: "Subscription Expired",
    body: "Subscribe again to continue accessing content.",
    data: { type: "subscription_expired" },
  }),

  newAnnouncement: (title, preview) => ({
    title: `📢 ${title}`,
    body: preview || "Tap to read the full announcement.",
    data: { type: "announcement" },
  }),

  testResultsReady: (testTitle) => ({
    title: "Results Released!",
    body: `Results for "${testTitle}" are now available.`,
    data: { type: "test_results", testTitle },
  }),

  testPublished: (testTitle, department, dateStr, timeStr) => ({
    title: `📚 New Test: ${testTitle}`,
    body: `Scheduled for ${department} students on ${dateStr} at ${timeStr}. Enroll now!`,
    data: { type: "test_published", testTitle, department, date: dateStr, time: timeStr },
  }),

  testThirtyMinWarningUnenrolled: (testTitle, timeStr) => ({
    title: `⏰ ${testTitle} starts in 30 minutes!`,
    body: `You haven't enrolled yet — enroll now before it's too late! Test begins at ${timeStr}.`,
    data: { type: "test_reminder_unenrolled", testTitle, time: timeStr },
  }),

  testThirtyMinWarningEnrolled: (testTitle, timeStr) => ({
    title: `⏰ ${testTitle} starts in 30 minutes`,
    body: `Your test begins at ${timeStr}. Get ready!`,
    data: { type: "test_reminder_enrolled", testTitle, time: timeStr },
  }),

  testStarted: (testTitle) => ({
    title: `🚀 ${testTitle} is Live Now!`,
    body: `The test is now ongoing. Open the app and start now!`,
    data: { type: "test_started", testTitle },
  }),

  emailVerificationReminder: () => ({
    title: "Verify Your Email",
    body: "Please verify your email address to unlock all features.",
    data: { type: "email_verification" },
  }),
};

// ── Register / unregister FCM token ──────────────────────────────────────────

const registerToken = async (userId, token) => {
  if (!token) return;
  await User().findByIdAndUpdate(userId, { $addToSet: { fcmTokens: token } });
  logger.info(`[FCM] Token registered for user ${userId}`);
};

const unregisterToken = async (userId, token) => {
  if (!token) return;
  await User().findByIdAndUpdate(userId, { $pull: { fcmTokens: token } });
  logger.info(`[FCM] Token unregistered for user ${userId}`);
};

module.exports = {
  fcmReady: () => fcmConfigured,
  sendToTokens,
  notifyUser,
  notifyUsers,
  registerToken,
  unregisterToken,
  notifications,
};
