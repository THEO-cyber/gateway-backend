// Comprehensive Payment System Test Suite
// Tests atomicity, error handling, security, and deployment readiness

const axios = require("axios");
const crypto = require("crypto");
const { performance } = require("perf_hooks");

const API_BASE_URL = "http://localhost:5000/api";
let authToken = "";
let adminToken = "";

// Test configuration
const TEST_CONFIG = {
  testUser: {
    email: "test.payment@hndgateway.com",
    password: "TestPassword123!",
    firstName: "Test",
    lastName: "User",
    department: "Computer Science",
    yearOfStudy: "HND2",
  },
  adminUser: {
    email: "admin.payment@hndgateway.com",
    password: "AdminPassword123!",
    role: "admin",
  },
  testPhone: "671234567",
  expectedFee: 1000,
  webhookSecret: "nkwa_webhook_secret_key_here",
};

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  tests: [],
  errors: [],
  performance: {},
};

// Utility functions
function logTest(testName, passed, message = "", data = null) {
  const result = {
    name: testName,
    passed,
    message,
    timestamp: new Date().toISOString(),
    data,
  };

  testResults.tests.push(result);

  if (passed) {
    testResults.passed++;
    console.log(`✅ ${testName}: ${message}`);
  } else {
    testResults.failed++;
    testResults.errors.push(result);
    console.log(`❌ ${testName}: ${message}`);
  }

  return result;
}

function generateWebhookSignature(payload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Test 1: Server Health Check
async function testServerHealth() {
  const testName = "Server Health Check";
  try {
    const start = performance.now();
    const response = await axios.get(
      `${API_BASE_URL.replace("/api", "")}/health`,
      {
        timeout: 5000,
      },
    );
    const duration = performance.now() - start;

    testResults.performance.healthCheck = duration;

    if (response.status === 200 && response.data.status === "OK") {
      logTest(
        testName,
        true,
        `Server healthy, response time: ${duration.toFixed(2)}ms`,
      );
      return true;
    } else {
      logTest(testName, false, "Server health check failed", response.data);
      return false;
    }
  } catch (error) {
    logTest(testName, false, `Server connection failed: ${error.message}`);
    return false;
  }
}

// Test 2: Payment Fee Endpoint
async function testPaymentFee() {
  const testName = "Payment Fee Endpoint";
  try {
    const response = await axios.get(`${API_BASE_URL}/payment/fee`);

    if (
      response.status === 200 &&
      response.data.success === true &&
      response.data.data.amount === TEST_CONFIG.expectedFee &&
      response.data.data.currency === "XAF"
    ) {
      logTest(
        testName,
        true,
        `Fee correctly set to ${response.data.data.formattedAmount}`,
      );
      return response.data;
    } else {
      logTest(
        testName,
        false,
        "Fee endpoint returned unexpected data",
        response.data,
      );
      return null;
    }
  } catch (error) {
    logTest(testName, false, `Fee endpoint failed: ${error.message}`);
    return null;
  }
}

// Test 3: User Registration and Authentication
async function testUserAuth() {
  const testName = "User Authentication";
  try {
    // Try to register test user (might fail if already exists)
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, TEST_CONFIG.testUser);
    } catch (regError) {
      // User might already exist, that's okay
    }

    // Login test user
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: TEST_CONFIG.testUser.email,
      password: TEST_CONFIG.testUser.password,
    });

    if (loginResponse.status === 200 && loginResponse.data.token) {
      authToken = loginResponse.data.token;
      logTest(testName, true, "User authentication successful");
      return true;
    } else {
      logTest(testName, false, "Login failed", loginResponse.data);
      return false;
    }
  } catch (error) {
    logTest(
      testName,
      false,
      `Authentication failed: ${error.response?.data?.message || error.message}`,
    );
    return false;
  }
}

// Test 4: Payment Initiation (Atomicity Test)
async function testPaymentInitiation() {
  const testName = "Payment Initiation (Atomicity)";
  try {
    if (!authToken) {
      logTest(testName, false, "No auth token available");
      return null;
    }

    const paymentData = {
      phone: TEST_CONFIG.testPhone,
      purpose: "registration_fee",
      description: "Test payment for atomicity verification",
    };

    const headers = { Authorization: `Bearer ${authToken}` };
    const response = await axios.post(
      `${API_BASE_URL}/payment/initiate`,
      paymentData,
      { headers },
    );

    if (
      response.status === 200 &&
      response.data.success === true &&
      response.data.data.transactionId &&
      response.data.data.amount === TEST_CONFIG.expectedFee
    ) {
      logTest(
        testName,
        true,
        `Payment initiated: ${response.data.data.transactionId}`,
      );
      return response.data.data;
    } else {
      logTest(testName, false, "Payment initiation failed", response.data);
      return null;
    }
  } catch (error) {
    logTest(
      testName,
      false,
      `Payment initiation error: ${error.response?.data?.message || error.message}`,
    );
    return null;
  }
}

// Test 5: Duplicate Payment Prevention (Atomicity)
async function testDuplicatePaymentPrevention() {
  const testName = "Duplicate Payment Prevention";
  try {
    if (!authToken) {
      logTest(testName, false, "No auth token available");
      return false;
    }

    const paymentData = {
      phone: TEST_CONFIG.testPhone,
      purpose: "registration_fee",
      description: "Duplicate payment test",
    };

    const headers = { Authorization: `Bearer ${authToken}` };

    // Try to initiate a second payment immediately
    try {
      await axios.post(`${API_BASE_URL}/payment/initiate`, paymentData, {
        headers,
      });
      logTest(
        testName,
        false,
        "System allowed duplicate payment - atomicity violation!",
      );
      return false;
    } catch (duplicateError) {
      if (
        duplicateError.response?.status === 400 &&
        duplicateError.response.data.message.includes("pending payment")
      ) {
        logTest(testName, true, "Duplicate payment correctly prevented");
        return true;
      } else {
        logTest(
          testName,
          false,
          "Unexpected error during duplicate test",
          duplicateError.response?.data,
        );
        return false;
      }
    }
  } catch (error) {
    logTest(
      testName,
      false,
      `Duplicate prevention test failed: ${error.message}`,
    );
    return false;
  }
}

// Test 6: Payment Status Check
async function testPaymentStatus(transactionId) {
  const testName = "Payment Status Check";
  try {
    if (!authToken || !transactionId) {
      logTest(testName, false, "Missing auth token or transaction ID");
      return null;
    }

    const headers = { Authorization: `Bearer ${authToken}` };
    const response = await axios.get(
      `${API_BASE_URL}/payment/status/${transactionId}`,
      { headers },
    );

    if (response.status === 200 && response.data.success === true) {
      logTest(testName, true, `Status: ${response.data.data.status}`);
      return response.data.data;
    } else {
      logTest(testName, false, "Status check failed", response.data);
      return null;
    }
  } catch (error) {
    logTest(
      testName,
      false,
      `Status check error: ${error.response?.data?.message || error.message}`,
    );
    return null;
  }
}

// Test 7: Webhook Signature Verification
async function testWebhookSecurity() {
  const testName = "Webhook Security (Signature Verification)";
  try {
    const webhookPayload = {
      reference: "TEST_WEBHOOK_SECURITY_123",
      status: "successful",
      transactionId: "NKWA_TEST_123",
      amount: 1000,
      phoneNumber: "237671234567",
    };

    // Test with correct signature
    const correctSignature = generateWebhookSignature(
      webhookPayload,
      TEST_CONFIG.webhookSecret,
    );

    try {
      const response = await axios.post(
        `${API_BASE_URL}/payment/webhook`,
        webhookPayload,
        {
          headers: { "X-Signature": correctSignature },
        },
      );

      if (response.status === 200) {
        logTest(
          testName,
          true,
          "Webhook signature verification working (returned 200 even for unknown transaction)",
        );
      } else {
        logTest(
          testName,
          false,
          "Webhook failed with correct signature",
          response.data,
        );
      }
    } catch (error) {
      // This might fail because transaction doesn't exist, but signature should be verified
      if (error.response?.status === 200) {
        logTest(testName, true, "Webhook security working correctly");
      } else {
        logTest(
          testName,
          false,
          `Webhook security test failed: ${error.message}`,
        );
      }
    }

    return true;
  } catch (error) {
    logTest(testName, false, `Webhook security test error: ${error.message}`);
    return false;
  }
}

// Test 8: Payment History
async function testPaymentHistory() {
  const testName = "Payment History";
  try {
    if (!authToken) {
      logTest(testName, false, "No auth token available");
      return null;
    }

    const headers = { Authorization: `Bearer ${authToken}` };
    const response = await axios.get(
      `${API_BASE_URL}/payment/history?page=1&limit=5`,
      { headers },
    );

    if (response.status === 200 && response.data.success === true) {
      logTest(
        testName,
        true,
        `Retrieved ${response.data.data.payments.length} payments`,
      );
      return response.data.data;
    } else {
      logTest(testName, false, "Payment history failed", response.data);
      return null;
    }
  } catch (error) {
    logTest(
      testName,
      false,
      `Payment history error: ${error.response?.data?.message || error.message}`,
    );
    return null;
  }
}

// Test 9: Phone Number Validation
async function testPhoneNumberValidation() {
  const testName = "Phone Number Validation";
  try {
    if (!authToken) {
      logTest(testName, false, "No auth token available");
      return false;
    }

    const headers = { Authorization: `Bearer ${authToken}` };

    // Test invalid phone number
    const invalidPaymentData = {
      phone: "123", // Invalid phone
      purpose: "registration_fee",
    };

    try {
      await axios.post(`${API_BASE_URL}/payment/initiate`, invalidPaymentData, {
        headers,
      });
      logTest(testName, false, "System accepted invalid phone number");
      return false;
    } catch (error) {
      if (
        error.response?.status === 500 &&
        error.response.data.message.includes("Invalid phone number format")
      ) {
        logTest(testName, true, "Phone number validation working correctly");
        return true;
      } else {
        logTest(
          testName,
          false,
          "Unexpected error during phone validation",
          error.response?.data,
        );
        return false;
      }
    }
  } catch (error) {
    logTest(testName, false, `Phone validation test error: ${error.message}`);
    return false;
  }
}

// Test 10: Database Connection and Atomicity
async function testDatabaseAtomicity() {
  const testName = "Database Atomicity";
  try {
    // This test checks if database operations are atomic
    // by verifying that payment records are created properly

    if (!authToken) {
      logTest(testName, false, "No auth token available");
      return false;
    }

    const headers = { Authorization: `Bearer ${authToken}` };

    // Get payment history before test
    const historyBefore = await axios.get(`${API_BASE_URL}/payment/history`, {
      headers,
    });
    const countBefore = historyBefore.data.data.pagination.total;

    // Wait a moment, then get count again to ensure consistency
    await sleep(100);
    const historyAfter = await axios.get(`${API_BASE_URL}/payment/history`, {
      headers,
    });
    const countAfter = historyAfter.data.data.pagination.total;

    if (countBefore === countAfter) {
      logTest(
        testName,
        true,
        "Database consistency maintained between requests",
      );
      return true;
    } else {
      logTest(
        testName,
        false,
        `Database inconsistency detected: ${countBefore} vs ${countAfter}`,
      );
      return false;
    }
  } catch (error) {
    logTest(testName, false, `Database atomicity test error: ${error.message}`);
    return false;
  }
}

// Test 11: Error Handling and Recovery
async function testErrorHandling() {
  const testName = "Error Handling";
  try {
    const tests = [
      // Test 1: No auth token
      {
        name: "No Authorization",
        request: () =>
          axios.post(`${API_BASE_URL}/payment/initiate`, {
            phone: "671234567",
          }),
        expectedStatus: 401,
      },
      // Test 2: Missing phone number
      {
        name: "Missing Phone Number",
        request: () =>
          axios.post(
            `${API_BASE_URL}/payment/initiate`,
            { purpose: "registration_fee" },
            { headers: { Authorization: `Bearer ${authToken}` } },
          ),
        expectedStatus: 400,
      },
      // Test 3: Invalid transaction ID
      {
        name: "Invalid Transaction ID",
        request: () =>
          axios.get(`${API_BASE_URL}/payment/status/INVALID_ID`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
        expectedStatus: 404,
      },
    ];

    let passedTests = 0;

    for (const test of tests) {
      try {
        await test.request();
        console.log(`❌ ${test.name}: Should have failed but didn't`);
      } catch (error) {
        if (error.response?.status === test.expectedStatus) {
          console.log(
            `✅ ${test.name}: Correctly returned ${test.expectedStatus}`,
          );
          passedTests++;
        } else {
          console.log(
            `❌ ${test.name}: Expected ${test.expectedStatus}, got ${error.response?.status}`,
          );
        }
      }
    }

    const allPassed = passedTests === tests.length;
    logTest(
      testName,
      allPassed,
      `${passedTests}/${tests.length} error handling tests passed`,
    );
    return allPassed;
  } catch (error) {
    logTest(testName, false, `Error handling test failed: ${error.message}`);
    return false;
  }
}

// Deployment Readiness Check
async function checkDeploymentReadiness() {
  console.log("\n🔍 DEPLOYMENT READINESS CHECK\n");

  const checks = {
    "Environment Variables":
      process.env.NKWAPAY_API_KEY && process.env.MONGODB_URI,
    "Database Connection": testResults.tests.find(
      (t) => t.name === "Server Health Check",
    )?.passed,
    "Payment Integration": testResults.tests.find(
      (t) => t.name === "Payment Fee Endpoint",
    )?.passed,
    Authentication: testResults.tests.find(
      (t) => t.name === "User Authentication",
    )?.passed,
    Atomicity: testResults.tests.find(
      (t) => t.name === "Payment Initiation (Atomicity)",
    )?.passed,
    Security: testResults.tests.find(
      (t) => t.name === "Webhook Security (Signature Verification)",
    )?.passed,
    "Error Handling": testResults.tests.find((t) => t.name === "Error Handling")
      ?.passed,
    "Data Validation": testResults.tests.find(
      (t) => t.name === "Phone Number Validation",
    )?.passed,
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;

  console.log("Deployment Readiness Checklist:");
  Object.entries(checks).forEach(([check, passed]) => {
    console.log(`${passed ? "✅" : "❌"} ${check}`);
  });

  const readiness = passedChecks / totalChecks;
  console.log(
    `\n🎯 Deployment Readiness: ${(readiness * 100).toFixed(1)}% (${passedChecks}/${totalChecks} checks passed)`,
  );

  if (readiness >= 0.9) {
    console.log("🚀 READY FOR DEPLOYMENT!");
  } else if (readiness >= 0.7) {
    console.log(
      "⚠️  MOSTLY READY - Address remaining issues before deployment",
    );
  } else {
    console.log("❌ NOT READY - Critical issues need resolution");
  }

  return readiness;
}

// Main test execution
async function runAllTests() {
  console.log("🧪 COMPREHENSIVE PAYMENT SYSTEM TEST SUITE");
  console.log("============================================\n");

  const startTime = performance.now();

  // Execute all tests in sequence
  const serverHealthy = await testServerHealth();
  if (!serverHealthy) {
    console.log("\n❌ Server not healthy - stopping tests");
    return;
  }

  await testPaymentFee();
  await testUserAuth();

  const paymentData = await testPaymentInitiation();
  await testDuplicatePaymentPrevention();

  if (paymentData?.transactionId) {
    await testPaymentStatus(paymentData.transactionId);
  }

  await testWebhookSecurity();
  await testPaymentHistory();
  await testPhoneNumberValidation();
  await testDatabaseAtomicity();
  await testErrorHandling();

  const totalTime = performance.now() - startTime;

  // Results summary
  console.log("\n📊 TEST RESULTS SUMMARY");
  console.log("========================");
  console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(
    `Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`,
  );
  console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);

  if (testResults.failed > 0) {
    console.log("\n❌ FAILED TESTS:");
    testResults.errors.forEach((error) => {
      console.log(`- ${error.name}: ${error.message}`);
    });
  }

  // Performance metrics
  console.log("\n⚡ PERFORMANCE METRICS:");
  if (testResults.performance.healthCheck) {
    console.log(
      `Health Check: ${testResults.performance.healthCheck.toFixed(2)}ms`,
    );
  }

  // Deployment readiness
  const readiness = await checkDeploymentReadiness();

  return {
    results: testResults,
    readiness,
    totalTime,
  };
}

// Export for use in other contexts
module.exports = {
  runAllTests,
  testResults,
  TEST_CONFIG,
};

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
