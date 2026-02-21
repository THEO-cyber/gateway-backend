#!/usr/bin/env node
require("dotenv").config();
const http = require("http");
const logger = require("../src/utils/logger");

const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || "localhost";

async function healthCheck() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: "/health",
      method: "GET",
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const health = JSON.parse(data);
          resolve({ status: res.statusCode, health });
        } catch (error) {
          reject(new Error("Invalid health response"));
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Health check timeout"));
    });

    req.end();
  });
}

async function main() {
  try {
    logger.info("🏥 Performing health check...");

    const { status, health } = await healthCheck();

    if (status === 200) {
      logger.info("✅ Server is healthy");
      console.log(JSON.stringify(health, null, 2));
      process.exit(0);
    } else {
      logger.error(`❌ Server unhealthy (Status: ${status})`);
      console.log(JSON.stringify(health, null, 2));
      process.exit(1);
    }
  } catch (error) {
    logger.error(`❌ Health check failed: ${error.message}`);
    process.exit(1);
  }
}

main();
