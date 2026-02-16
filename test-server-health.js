const http = require("http");

console.log("🔍 Testing server connectivity...");

const options = {
  hostname: "localhost",
  port: 5000,
  path: "/api/payment/initiate",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 5000,
};

const req = http.request(options, (res) => {
  console.log(`✅ Server is responding! Status: ${res.statusCode}`);

  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    try {
      const response = JSON.parse(data);
      console.log("Response:", response);

      if (res.statusCode === 401) {
        console.log("✅ Server is working - Expected auth error received");
      } else if (res.statusCode === 200) {
        console.log("✅ Server is working - Request successful");
      }
    } catch (e) {
      console.log("Response (raw):", data);
    }
    process.exit(0);
  });
});

req.on("error", (error) => {
  console.log("❌ Server connection failed:", error.message);
  console.log("");
  console.log("Possible issues:");
  console.log("- Server not started");
  console.log("- Port 5000 blocked");
  console.log("- Server crashed during startup");
  process.exit(1);
});

req.on("timeout", () => {
  console.log("❌ Request timed out");
  req.destroy();
  process.exit(1);
});

req.write(
  JSON.stringify({
    phoneNumber: "237671234567",
  }),
);

req.end();
