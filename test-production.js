const axios = require("axios");
require("dotenv").config();

async function testProductionEndpoint() {
  console.log("🔍 Testing Production Endpoint as Backup...\n");

  const apiKey = process.env.NKWAPAY_API_KEY;
  const stagingUrl = "https://api.pay.staging.mynkwa.com";
  const productionUrl = "https://api.pay.mynkwa.com";

  console.log(`API Key: ${apiKey.substring(0, 5)}...`);
  console.log(`Testing both staging and production endpoints\n`);

  const testData = {
    amount: 1000,
    phoneNumber: "237671234567",
    reference: `TEST_${Date.now()}`,
    description: "Production endpoint test",
  };

  const urls = [
    { name: "Staging", url: stagingUrl },
    { name: "Production", url: productionUrl },
  ];

  for (const urlConfig of urls) {
    console.log(`🌐 Testing ${urlConfig.name}: ${urlConfig.url}/collect`);
    console.log("-".repeat(50));

    try {
      const response = await axios.post(`${urlConfig.url}/collect`, testData, {
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      });

      console.log(`✅ SUCCESS on ${urlConfig.name}!`);
      console.log(`Status: ${response.status}`);
      console.log("Response:", JSON.stringify(response.data, null, 2));

      // Update .env file if production works
      if (urlConfig.name === "Production") {
        console.log(
          "\n🔄 Production endpoint works! Consider updating your .env file:",
        );
        console.log(`NKWAPAY_BASE_URL=${productionUrl}`);
      }
      return;
    } catch (error) {
      console.log(`❌ Failed on ${urlConfig.name}`);
      if (error.response) {
        console.log(`Status: ${error.response.status}`);
        console.log("Response:", JSON.stringify(error.response.data, null, 2));
      } else {
        console.log(`Error: ${error.message}`);
      }
    }
    console.log();
  }

  console.log("\n📋 Summary:");
  console.log("❌ Both staging and production endpoints failed");
  console.log("🔑 This confirms the API key issue");
  console.log("\n✅ Next Steps:");
  console.log("1. Contact Nkwa Pay support immediately");
  console.log("2. Request API key activation/verification");
  console.log("3. Ask for correct authentication method");
  console.log("4. Provide them with your merchant details");
}

testProductionEndpoint().catch(console.error);
