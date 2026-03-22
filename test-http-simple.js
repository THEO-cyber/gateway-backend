#!/usr/bin/env node

/**
 * Simple HTTP Test - Diagnose connectivity over hotspot
 * Run this to verify basic HTTP communication works
 */

const http = require("http");

const apiUrl = process.argv[2] || "http://10.109.74.55:5000";
const path = process.argv[3] || "/health";

// Parse URL
const url = new URL(apiUrl);
const options = {
  hostname: url.hostname,
  port: url.port || 5000,
  path: path,
  method: "GET",
  headers: {
    "User-Agent": "cellular-test-simple/1.0",
    Authorization: "Bearer test-token-" + Date.now(),
    "X-Device-ID": "test-device-123",
  },
  timeout: 5000,
};

console.log("\n📡 SIMPLE HTTP TEST");
console.log("=".repeat(60));
console.log(`Target: ${apiUrl}${path}`);
console.log(`Method: ${options.method}`);
console.log(`Headers:`, options.headers);
console.log("=".repeat(60) + "\n");

const req = http.request(options, (res) => {
  console.log(`✓ Response Status: ${res.statusCode}`);
  console.log(`✓ Response Headers:`, res.headers);

  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log(`✓ Response Body:\n${data}`);
    console.log("\n✅ SUCCESS: HTTP connection works!");
    process.exit(0);
  });
});

req.on("error", (error) => {
  console.error(`✗ ERROR: ${error.message}`);
  console.error(`✗ Code: ${error.code}`);
  process.exit(1);
});

req.on("timeout", () => {
  console.error("✗ TIMEOUT: Request took too long");
  req.destroy();
  process.exit(1);
});

req.end();
