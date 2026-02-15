// Debug script to test Nkwa Pay API directly
// Run with: node debug-nkwa-api.js

const axios = require("axios");
require("dotenv").config();

async function testNkwaPayAPI() {
  console.log("🔍 Testing Nkwa Pay API Configuration...\n");

  // Check environment variables
  console.log("📋 Environment Variables:");
  console.log(
    "API Key:",
    process.env.NKWAPAY_API_KEY
      ? `${process.env.NKWAPAY_API_KEY.substring(0, 10)}...`
      : "MISSING",
  );
  console.log("Base URL:", process.env.NKWAPAY_BASE_URL);
  console.log("Payment Fee:", process.env.PAYMENT_FEE);
  console.log("");

  // Test API endpoint accessibility
  console.log("🌐 Testing API Endpoint...");
  try {
    const healthCheck = await axios.get(process.env.NKWAPAY_BASE_URL, {
      timeout: 5000,
    });
    console.log("✅ API endpoint is accessible");
  } catch (error) {
    console.log("❌ API endpoint issue:", error.code || error.message);
  }

  // Test payment initiation with various header formats
  const testPaymentData = {
    amount: 1000,
    phoneNumber: "237671234567",
    reference: `TEST_${Date.now()}`,
    description: "Test payment for API verification",
  };

  console.log("💳 Testing Payment API Call...");
  console.log("Test Data:", testPaymentData);
  console.log("");

  // Test with X-API-KEY header (current format)
  console.log("🔧 Test 1: X-API-KEY header");
  try {
    const response1 = await axios.post(
      `${process.env.NKWAPAY_BASE_URL}/collect`,
      testPaymentData,
      {
        headers: {
          "X-API-KEY": process.env.NKWAPAY_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );
    console.log("✅ Success with X-API-KEY");
    console.log("Response:", response1.data);
  } catch (error) {
    console.log("❌ Failed with X-API-KEY");
    console.log("Status:", error.response?.status);
    console.log("Response:", error.response?.data);
    console.log("Error:", error.message);
  }

  console.log("");

  // Test with Authorization header (alternative format)
  console.log("🔧 Test 2: Authorization Bearer header");
  try {
    const response2 = await axios.post(
      `${process.env.NKWAPAY_BASE_URL}/collect`,
      testPaymentData,
      {
        headers: {
          Authorization: `Bearer ${process.env.NKWAPAY_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );
    console.log("✅ Success with Authorization Bearer");
    console.log("Response:", response2.data);
  } catch (error) {
    console.log("❌ Failed with Authorization Bearer");
    console.log("Status:", error.response?.status);
    console.log("Response:", error.response?.data);
  }

  console.log("");

  // Test with API-Key header (another alternative)
  console.log("🔧 Test 3: API-Key header");
  try {
    const response3 = await axios.post(
      `${process.env.NKWAPAY_BASE_URL}/collect`,
      testPaymentData,
      {
        headers: {
          "API-Key": process.env.NKWAPAY_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );
    console.log("✅ Success with API-Key");
    console.log("Response:", response3.data);
  } catch (error) {
    console.log("❌ Failed with API-Key");
    console.log("Status:", error.response?.status);
    console.log("Response:", error.response?.data);
  }

  console.log("");

  // Test API key validation
  console.log("🔍 API Key Validation:");
  console.log("Length:", process.env.NKWAPAY_API_KEY?.length);
  console.log(
    "Format:",
    process.env.NKWAPAY_API_KEY?.includes("-")
      ? "Contains dashes"
      : "No dashes",
  );
  console.log("Starts with:", process.env.NKWAPAY_API_KEY?.substring(0, 5));

  console.log("\n📋 Recommendations:");
  console.log("1. Verify your API key is correct in Nkwa Pay dashboard");
  console.log("2. Check if you need to activate/enable the API key");
  console.log("3. Confirm you're using the staging endpoint for testing");
  console.log("4. Contact Nkwa Pay support if the API key appears correct");
}

testNkwaPayAPI().catch(console.error);
