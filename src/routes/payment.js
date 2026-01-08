const express = require("express");
const router = express.Router();
const { initiatePayment } = require("../services/campayService");

// Campay webhook endpoint for payment confirmation
router.post("/webhook", (req, res) => {
  // Security: Validate Campay webhook key
  const receivedKey =
    req.headers["x-campay-webhook-key"] || req.body.webhook_key;
  const expectedKey = process.env.CAMPAY_WEBHOOK_KEY;
  if (!expectedKey || receivedKey !== expectedKey) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized webhook" });
  }

  // TODO: Update user access/payment status in your DB based on req.body
  // Example: req.body.reference, req.body.status, req.body.amount, req.body.phone

  // Always respond 200 to acknowledge receipt
  res.status(200).json({ success: true });
});

// POST /api/payment/initiate
// Secure payment initiation endpoint
router.post("/initiate", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required." });
    }
    // Initiate payment of 1000 XAF
    const result = await initiatePayment({
      amount: 1000,
      phone,
      description: "App access payment",
    });
    res.json({ success: true, data: result });
  } catch (error) {
    // Never leak sensitive error details
    res
      .status(500)
      .json({ success: false, message: "Payment initiation failed." });
  }
});

module.exports = router;
