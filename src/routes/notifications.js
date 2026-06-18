const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/adminAuth");
const { registerToken, unregisterToken, fcmReady, notifyUsers, sendToTokens } = require("../services/notificationService");
const User = require("../models/User");
const logger = require("../utils/logger");

// POST /api/notifications/register-token
// Body: { token: "<fcm-device-token>" }
router.post("/register-token", protect, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: "FCM token is required" });
    }
    await registerToken(req.user._id, token);
    res.json({ success: true, message: "Device registered for push notifications" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to register device token" });
  }
});

// DELETE /api/notifications/unregister-token
// Body: { token: "<fcm-device-token>" }
router.delete("/unregister-token", protect, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: "FCM token is required" });
    }
    await unregisterToken(req.user._id, token);
    res.json({ success: true, message: "Device unregistered from push notifications" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to unregister device token" });
  }
});

// GET /api/notifications/status
router.get("/status", (req, res) => {
  res.json({
    success: true,
    fcmEnabled: fcmReady(),
    message: fcmReady() ? "Push notifications are active" : "Push notifications not configured (set Firebase env vars)",
  });
});

// ── Admin notification endpoints ──────────────────────────────────────────────

// POST /api/notifications/send-all
// Send to every active user
// Body: { title, body, data? }
router.post("/send-all", protect, isAdmin, async (req, res) => {
  try {
    const { title, body, data = {} } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: "Title and body are required" });
    }

    const users = await User.find({ isActive: true, isBanned: false }).select("+fcmTokens");
    const allTokens = users.flatMap((u) => u.fcmTokens || []).filter(Boolean);

    if (!allTokens.length) {
      return res.json({ success: true, message: "No devices registered for push notifications", sent: 0 });
    }

    const result = await sendToTokens(allTokens, { title, body, data });
    logger.info(`[Admin] Broadcast sent: ${result.successCount}/${allTokens.length} delivered`);

    res.json({
      success: true,
      message: `Notification sent to ${result.successCount} device(s)`,
      sent: result.successCount,
      failed: result.failureCount,
      totalUsers: users.length,
    });
  } catch (error) {
    logger.error(`[Admin] send-all failed: ${error.message}`);
    res.status(500).json({ success: false, message: "Failed to send notification" });
  }
});

// POST /api/notifications/send-department
// Send to all users in a specific department
// Body: { title, body, department, data? }
router.post("/send-department", protect, isAdmin, async (req, res) => {
  try {
    const { title, body, department, data = {} } = req.body;
    if (!title || !body || !department) {
      return res.status(400).json({ success: false, message: "Title, body, and department are required" });
    }

    const users = await User.find({ department, isActive: true, isBanned: false }).select("+fcmTokens");
    const allTokens = users.flatMap((u) => u.fcmTokens || []).filter(Boolean);

    if (!allTokens.length) {
      return res.json({ success: true, message: `No registered devices found for ${department}`, sent: 0 });
    }

    const result = await sendToTokens(allTokens, { title, body, data });
    logger.info(`[Admin] Dept "${department}" notification: ${result.successCount}/${allTokens.length} delivered`);

    res.json({
      success: true,
      message: `Notification sent to ${result.successCount} device(s) in ${department}`,
      sent: result.successCount,
      failed: result.failureCount,
      totalUsers: users.length,
    });
  } catch (error) {
    logger.error(`[Admin] send-department failed: ${error.message}`);
    res.status(500).json({ success: false, message: "Failed to send notification" });
  }
});

// POST /api/notifications/send-user
// Send to a single user by their userId
// Body: { title, body, userId, data? }
router.post("/send-user", protect, isAdmin, async (req, res) => {
  try {
    const { title, body, userId, data = {} } = req.body;
    if (!title || !body || !userId) {
      return res.status(400).json({ success: false, message: "Title, body, and userId are required" });
    }

    const user = await User.findById(userId).select("+fcmTokens");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.fcmTokens?.length) {
      return res.json({ success: true, message: "User has no registered devices", sent: 0 });
    }

    const result = await sendToTokens(user.fcmTokens, { title, body, data });
    logger.info(`[Admin] User ${userId} notification: ${result.successCount}/${user.fcmTokens.length} delivered`);

    res.json({
      success: true,
      message: `Notification sent to ${result.successCount} device(s)`,
      sent: result.successCount,
      failed: result.failureCount,
    });
  } catch (error) {
    logger.error(`[Admin] send-user failed: ${error.message}`);
    res.status(500).json({ success: false, message: "Failed to send notification" });
  }
});

module.exports = router;
