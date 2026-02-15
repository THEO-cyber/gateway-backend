const axios = require("axios");
require("dotenv").config();

async function debugNkwaPayAPI() {
  console.log("🔍 Comprehensive Nkwa Pay API Debug...\n");

  const apiKey = process.env.NKWAPAY_API_KEY;
  const baseUrl = process.env.NKWAPAY_BASE_URL;

  console.log("📋 Configuration:");
  console.log(`API Key: ${apiKey.substring(0, 5)}...`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Full API Key Length: ${apiKey.length}`);
  console.log(`API Key: ${apiKey}\n`);

  // Test data
  const testData = {
    amount: 1000,
    phoneNumber: "237671234567",
    reference: `TEST_${Date.now()}`,
    description: "Comprehensive API test",
  };

  console.log("📱 Test Data:", JSON.stringify(testData, null, 2));
  console.log("\n" + "=".repeat(50));

  const authMethods = [
    {
      name: "X-API-KEY",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    },
    {
      name: "Authorization Bearer",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
    {
      name: "API-Key",
      headers: { "API-Key": apiKey, "Content-Type": "application/json" },
    },
    {
      name: "x-api-key (lowercase)",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    },
    {
      name: "apikey",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
    },
    {
      name: "X-Auth-Token",
      headers: { "X-Auth-Token": apiKey, "Content-Type": "application/json" },
    },
  ];

  // Test different endpoints
  const endpoints = ["/collect", "/payment", "/payments/initiate"];

  for (const endpoint of endpoints) {
    console.log(`\n🌐 Testing endpoint: ${baseUrl}${endpoint}`);
    console.log("-".repeat(40));

    for (const method of authMethods) {
      try {
        console.log(`\n🔧 Testing: ${method.name}`);

        const response = await axios.post(`${baseUrl}${endpoint}`, testData, {
          headers: method.headers,
          timeout: 10000,
        });

        console.log(`✅ SUCCESS with ${method.name}!`);
        console.log(`Status: ${response.status}`);
        console.log("Response:", JSON.stringify(response.data, null, 2));
        return; // Exit on first success
      } catch (error) {
        console.log(`❌ Failed with ${method.name}`);
        if (error.response) {
          console.log(`Status: ${error.response.status}`);
          console.log(
            "Response:",
            JSON.stringify(error.response.data, null, 2),
          );
        } else if (error.code === "ENOTFOUND") {
          console.log("❌ DNS Error: Cannot resolve domain");
        } else {
          console.log(`Error: ${error.message}`);
        }
      }
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("🔍 Additional Debug Info:");

  // Test if it's an IP restriction
  try {
    const ipResponse = await axios.get("https://httpbin.org/ip");
    console.log(`Your IP: ${ipResponse.data.origin}`);
  } catch (error) {
    console.log("Could not get IP address");
  }

  // Test basic connectivity to Nkwa Pay
  try {
    console.log("\n🌐 Testing basic connectivity...");
    const connectTest = await axios.get(baseUrl, { timeout: 5000 });
    console.log(`✅ Base URL is accessible (Status: ${connectTest.status})`);
  } catch (error) {
    if (error.response) {
      console.log(`⚠️ Base URL returned status: ${error.response.status}`);
    } else {
      console.log(`❌ Cannot connect to base URL: ${error.message}`);
    }
  }

  console.log("\n📋 Next Steps:");
  console.log("1. Verify API key in Nkwa Pay dashboard");
  console.log("2. Check if API key is activated/enabled");
  console.log("3. Confirm IP whitelisting (if required)");
  console.log("4. Contact Nkwa Pay support with this debug info");
  console.log("5. Try production endpoint if staging is having issues");
}

// Run the debug
debugNkwaPayAPI().catch(console.error);
