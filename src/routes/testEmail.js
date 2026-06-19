const express = require("express");
const router = express.Router();
const sendEmail = require("../services/emailService");
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/adminAuth");

router.post("/test-email", protect, isAdmin, async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;
    if (!to) return res.status(400).json({ success: false, message: "Recipient email (to) is required" });

    await sendEmail({
      to,
      subject: subject || "Test Email – HND Gateway",
      text: text || "This is a test email from HND Gateway.",
      html: html || "<p>This is a <strong>test email</strong> from HND Gateway via Gmail.</p>",
    });
    res.json({ success: true, message: "Test email sent successfully via Gmail." });
  } catch {
    res.status(500).json({ success: false, message: "Failed to send test email" });
  }
});

module.exports = router;
