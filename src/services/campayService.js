// src/services/campayService.js
const axios = require("axios");

// Use environment variable for base URL (production/sandbox)
// For sandbox/testing, use https://demo.campay.net/api
const CAMPAY_BASE_URL =
  process.env.CAMPAY_BASE_URL || "https://api.campay.net/api";
const CAMPAY_API_KEY = process.env.CAMPAY_API_KEY;
const CAMPAY_API_SECRET = process.env.CAMPAY_API_SECRET;

// Never log secrets or sensitive data

// Get Campay access token securely
async function getAccessToken() {
  if (!CAMPAY_API_KEY || !CAMPAY_API_SECRET) {
    throw new Error("Campay API credentials are not set");
  }
  const response = await axios.post(`${CAMPAY_BASE_URL}/token/`, {
    username: CAMPAY_API_KEY,
    password: CAMPAY_API_SECRET,
  });
  return response.data.token;
}

// Validate phone and amount before initiating payment
function isValidPhone(phone) {
  // Basic validation for Cameroon numbers (starts with 6, 9 digits)
  return /^6\d{8}$/.test(phone);
}

async function initiatePayment({ amount, phone, description }) {
  if (!isValidPhone(phone)) {
    throw new Error(
      "Invalid phone number format. Must be a valid Cameroon mobile number."
    );
  }
  if (typeof amount !== "number" || amount < 25) {
    throw new Error("Invalid payment amount.");
  }
  const token = await getAccessToken();
  const response = await axios.post(
    `${CAMPAY_BASE_URL}/collection/`,
    {
      amount,
      currency: "XAF",
      from: phone,
      description,
      external_reference: `access_${Date.now()}`,
    },
    {
      headers: { Authorization: `Token ${token}` },
      httpsAgent: new (require("https").Agent)({ rejectUnauthorized: true }), // Enforce HTTPS
    }
  );
  return response.data;
}

module.exports = { initiatePayment };
