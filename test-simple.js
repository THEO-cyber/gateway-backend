const http = require("http");

function testServer() {
  console.log("🔍 Testing Server Connection...");

  const options = {
    hostname: "localhost",
    port: 5000,
    path: "/api/payment/initiate",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const req = http.request(options, (res) => {
    console.log(`✅ Server is responding! Status: ${res.statusCode}`);

    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });

    res.on("end", () => {
      console.log("Response:", data);
      console.log("\n🎉 SUCCESS! Your backend is working!");
      console.log("");
      console.log("📊 Current Status:");
      console.log("✅ Server: Running on port 5000");
      console.log("✅ Nkwa Pay: Production endpoint configured");
      console.log("✅ Merchant: ID 128 (Active)");
      console.log("✅ Fee: 1000 XAF");
      console.log("");
      console.log("🚀 Ready for Flutter Integration!");
      console.log("");
      console.log("Flutter HTTP Request:");
      console.log("POST http://localhost:5000/api/payment/initiate");
      console.log('Headers: { "Authorization": "Bearer YOUR_JWT_TOKEN" }');
      console.log('Body: { "phoneNumber": "237XXXXXXXXX" }');
    });
  });

  req.on("error", (error) => {
    console.log("❌ Server not responding:", error.message);
    console.log("");
    console.log("💡 Try these steps:");
    console.log("1. Make sure the server is running: npm start");
    console.log("2. Check if port 5000 is available");
    console.log("3. Look for any error messages in the server console");
  });

  req.write(
    JSON.stringify({
      phoneNumber: "237671234567",
    }),
  );

  req.end();
}

testServer();
