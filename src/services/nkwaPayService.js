// src/services/nkwaPayService.js
const axios = require("axios");

const NKWAPAY_BASE_URL =
  process.env.NKWAPAY_BASE_URL || "https://api.pay.staging.mynkwa.com";
const NKWAPAY_API_KEY = process.env.NKWAPAY_API_KEY;

async function initiateNkwaPayment({ amount, phoneNumber }) {
  if (!NKWAPAY_API_KEY) {
    console.error("[NkwaPayService] Nkwa Pay API key not set");
    throw new Error("Nkwa Pay API key not set");
  }
  if (!amount || !phoneNumber) {
    console.error("[NkwaPayService] Amount and phoneNumber required", {
      amount,
      phoneNumber,
    });
    throw new Error("Amount and phoneNumber required");
  }
  try {
    const response = await axios.post(
      `${NKWAPAY_BASE_URL}/collect`,
      { amount, phoneNumber },
      { headers: { "X-API-Key": NKWAPAY_API_KEY } }
    );
    return response.data;
  } catch (err) {
    if (err.response) {
      console.error("[NkwaPayService] Nkwa Pay API error:", {
        status: err.response.status,
        data: err.response.data,
        headers: err.response.headers,
      });
    } else {
      console.error("[NkwaPayService] Error:", err.message, err.stack);
    }
    throw err;
  }
}

module.exports = { initiateNkwaPayment };
