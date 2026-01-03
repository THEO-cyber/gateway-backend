// Test route for sending email with Resend
const express = require("express");
const router = express.Router();
const sendEmail = require("../services/emailService");

router.post("/test-email", async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;
    await sendEmail({
      to,
      subject: subject || "Test Email from HND Gateway",
      text: text || "This is a test email sent using Resend.",
      html:
        html ||
        "<p>This is a <strong>test email</strong> sent using Resend.</p>",
    });
    res.json({ success: true, message: "Test email sent successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
