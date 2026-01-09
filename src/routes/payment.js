const express = require("express");
const router = express.Router();
const { initiateNkwaPayment } = require("../services/nkwaPayService");

// POST /api/payment/initiate
// Secure payment initiation endpoint
router.post("/initiate", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      console.error("[Payment] Missing phone number in request body", req.body);
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required." });
    }
    // Nkwa Pay expects phone in format '2376XXXXXXXX'
    const phoneNumber = phone.startsWith("237") ? phone : `237${phone}`;
    const result = await initiateNkwaPayment({ amount: 25, phoneNumber });
    res.json({ success: true, data: result });
  } catch (error) {
    // Enhanced error logging for debugging
    if (error.response) {
      console.error("[Payment] Nkwa Pay API error:", {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });
    } else {
      console.error("[Payment] Nkwa Pay error:", error.message, error.stack);
    }
    res
      .status(500)
      .json({
        success: false,
        message: "Payment initiation failed.",
        error: error.message,
      });
  }
});

module.exports = router;
