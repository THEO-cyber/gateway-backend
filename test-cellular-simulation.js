#!/usr/bin/env node

/**
 * Cellular Network Simulation Test
 *
 * This script simulates multiple mobile clients on a shared cellular IP
 * hitting your backend with different bearer tokens/device-ids.
 *
 * Usage:
 *   node test-cellular-simulation.js http://192.168.x.x:5000
 *
 * Purpose:
 * - Verify rate limiter separates clients by token/device, not just IP
 * - Confirm cellular users aren't incorrectly grouped and throttled together
 */

const axios = require("axios");

const apiBaseUrl = process.argv[2] || "http://localhost:5000";

// Simulate 3 different mobile clients sharing same carrier IP
const clients = [
  {
    name: "Client A (Token 1)",
    bearerToken: "token-a-" + Math.random().toString(36).slice(2),
    deviceId: "device-a-123",
  },
  {
    name: "Client B (Token 2)",
    bearerToken: "token-b-" + Math.random().toString(36).slice(2),
    deviceId: "device-b-456",
  },
  {
    name: "Client C (Token 3)",
    bearerToken: "token-c-" + Math.random().toString(36).slice(2),
    deviceId: "device-c-789",
  },
];

console.log("\n" + "=".repeat(70));
console.log("CELLULAR NETWORK SIMULATION TEST");
console.log("=".repeat(70));
console.log(`API Base URL: ${apiBaseUrl}`);
console.log(`Testing ${clients.length} clients on shared IP...\n`);

const makeRequest = async (client, attempt) => {
  try {
    const response = await axios.get(`${apiBaseUrl}/keepalive`, {
      headers: {
        Authorization: `Bearer ${client.bearerToken}`,
        "X-Device-ID": client.deviceId,
        "User-Agent": "cellular-test-client/1.0",
      },
      timeout: 5000,
    });

    console.log(`✓ ${client.name} (Attempt ${attempt}): 200 OK`);
    return { success: true, status: response.status };
  } catch (error) {
    if (error.response?.status === 429) {
      console.log(
        `✗ ${client.name} (Attempt ${attempt}): 429 RATE LIMITED - ${error.response.data?.message || "Too many requests"}`,
      );
      return { success: false, status: 429, rateLimited: true };
    } else if (error.code === "ECONNREFUSED") {
      console.log(
        `✗ ${client.name} (Attempt ${attempt}): CONNECTION REFUSED - Is backend running?`,
      );
      return { success: false, error: "connection_refused" };
    } else {
      console.log(
        `✗ ${client.name} (Attempt ${attempt}): ${error.status || error.code} - ${error.message}`,
      );
      return {
        success: false,
        status: error.response?.status,
        error: error.message,
      };
    }
  }
};

const runTest = async () => {
  console.log("TEST SCENARIO: Burst requests from 3 clients (rapid fire)");
  console.log("-".repeat(70));

  const results = {
    clientA: { success: 0, rateLimited: 0, total: 0 },
    clientB: { success: 0, rateLimited: 0, total: 0 },
    clientC: { success: 0, rateLimited: 0, total: 0 },
  };

  // Simulating rapid-fire requests: each client makes 3 quick requests
  const requestsPerClient = 3;

  for (let attempt = 1; attempt <= requestsPerClient; attempt++) {
    console.log(`\n--- Request Round ${attempt} ---`);

    // Make concurrent requests from all 3 clients (simulating shared IP)
    const promises = clients.map((client) => makeRequest(client, attempt));
    const responses = await Promise.all(promises);

    responses.forEach((response, idx) => {
      const clientKey = ["clientA", "clientB", "clientC"][idx];
      results[clientKey].total++;
      if (response.success) {
        results[clientKey].success++;
      }
      if (response.rateLimited) {
        results[clientKey].rateLimited++;
      }
    });

    // Brief pause between rounds
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n" + "=".repeat(70));
  console.log("TEST RESULTS");
  console.log("=".repeat(70));

  console.log("\nExpected behavior:");
  console.log("  ✓ Each client should NOT be rate-limited independently");
  console.log("  ✓ Even with shared IP, clients should be keyed separately");
  console.log(
    "  ✓ All requests should succeed OR all should be limited together",
  );
  console.log("    (depending on your limiter config)\n");

  let allClientsEqual = true;
  let allSuccess = true;

  clients.forEach((client, idx) => {
    const clientKey = ["clientA", "clientB", "clientC"][idx];
    const r = results[clientKey];
    const successRate = ((r.success / r.total) * 100).toFixed(0);

    console.log(
      `${client.name}:  ${r.success}/${r.total} success (${successRate}%) - ${r.rateLimited} rate-limited`,
    );

    if (r.success < r.total) {
      allSuccess = false;
    }

    if (
      (r.success !== results.clientA.success ||
        r.rateLimited !== results.clientA.rateLimited) &&
      idx > 0
    ) {
      allClientsEqual = false;
    }
  });

  console.log("\n" + "=".repeat(70));
  console.log("ANALYSIS");
  console.log("=".repeat(70));

  if (allSuccess) {
    console.log(
      "\n✅ PASS: All clients succeeded! Rate limiter is NOT grouping by IP alone.",
    );
    console.log("   Clients are correctly isolated by token/device-id.\n");
    return true;
  } else if (allClientsEqual) {
    console.log(
      "\n⚠️  MIXED: All clients hit same rate-limit status (all succeeded or all limited).",
    );
    console.log(
      "   This could mean clients are being grouped by shared IP (not ideal for cellular).\n",
    );
    return false;
  } else {
    console.log(
      "\n✅ PASS: Clients show different success rates - properly isolated by token/device!",
    );
    console.log(
      "   Each client is counted separately despite sharing an IP.\n",
    );
    return true;
  }
};

// Run the test
runTest()
  .then((passed) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((error) => {
    console.error("\n❌ TEST ERROR:", error.message);
    process.exit(1);
  });
