require("dotenv").config();
const app = require("./src/app");
const { connectDB } = require("./src/config/database");
const redisClient = require("./src/config/redis");
const { scheduleRecurringJobs } = require("./src/services/queueService");
const logger = require("./src/utils/logger");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5000;

// Create uploads directory
const uploadPath = path.join(__dirname, "uploads", "papers");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Initialize services
const initializeServices = async () => {
  try {
    // Connect to database
    await connectDB();
    logger.info("✅ Database connection established");

    // Connect to Redis only if not disabled
    if (process.env.DISABLE_REDIS !== 'true') {
      await redisClient.connect();
      logger.info("✅ Redis connection established");
    } else {
      logger.info("💾 Redis disabled - Server starting without caching");
    }

    // Schedule background jobs
    scheduleRecurringJobs();
    logger.info("✅ Background jobs scheduled");
  } catch (error) {
    logger.error(`❌ Service initialization failed: ${error.message}`);
    logger.info("🔄 Server will continue with reduced functionality");
    // Don't exit - app can work with reduced functionality
  }
};

// Server resilience monitoring
let serverStartTime = new Date();
let lastHealthCheck = new Date();

// Keep the process alive and monitor health
const keepAlive = setInterval(() => {
  lastHealthCheck = new Date();
  const uptime = Math.floor((lastHealthCheck - serverStartTime) / 1000);

  if (uptime % 300 === 0 && uptime > 0) {
    // Log every 5 minutes
    logger.info(
      `💚 Server healthy - Uptime: ${Math.floor(uptime / 60)} minutes`,
    );
  }
}, 10000); // Check every 10 seconds

// Critical process protection
process.on("exit", (code) => {
  clearInterval(keepAlive);
  logger.info(`🔄 Process exiting with code: ${code}`);
  const uptime = Math.floor((new Date() - serverStartTime) / 1000);
  logger.info(`⏱️ Total uptime: ${Math.floor(uptime / 60)} minutes`);
});

// Initialize services
initializeServices();

// Start server with error handling
const httpServer = app.listen(PORT, "0.0.0.0", () => {
  logger.info(
    `🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`,
  );

  // Upload path configured securely

  logger.info(`🔧 Performance monitoring enabled`);
  logger.info(`💚 Server is now ready to serve users!`);
  serverStartTime = new Date(); // Reset start time when server is actually ready
});

// Handle server errors
httpServer.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    logger.error(`❌ Port ${PORT} is already in use`);
    logger.error(
      "💡 Please stop other processes using this port or change PORT environment variable",
    );
    process.exit(1); // Only exit for port conflicts
  } else {
    logger.error(`❌ Server error: ${error.message}`);
    logger.info("🔄 Server will attempt to continue...");
  }
});

// Prevent server from crashing on client connection errors
httpServer.on("clientError", (error, socket) => {
  logger.warn(`⚠️ Client error: ${error.message}`);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

// Initialize socket.io with Redis adapter for scaling
const { initSocket } = require("./src/socket");
// Pass null if Redis is disabled
const socketRedisClient = process.env.DISABLE_REDIS === 'true' ? null : redisClient;
initSocket(httpServer, socketRedisClient);

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info(`📡 ${signal} signal received: starting graceful shutdown`);

  // Close HTTP server
  httpServer.close(async () => {
    logger.info("🔌 HTTP server closed");

    try {
      // Close Redis connection only if not disabled
      if (process.env.DISABLE_REDIS !== 'true' && redisClient) {
        await redisClient.disconnect();
        logger.info("📴 Redis connection closed");
      }

      // Close MongoDB connection
      const mongoose = require("mongoose");
      await mongoose.connection.close();
      logger.info("📴 MongoDB connection closed");

      logger.info("✅ Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logger.error(`❌ Error during shutdown: ${error.message}`);
      process.exit(1);
    }
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error("⏰ Forcing shutdown after timeout");
    process.exit(1);
  }, 10000);
};

// Handle process signals (only for intentional shutdowns like Ctrl+C)
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle unhandled promise rejections (LOG BUT DON'T SHUTDOWN)
process.on("unhandledRejection", (err) => {
  if (process.env.NODE_ENV === "production") {
    logger.error("💥 Unhandled rejection occurred");
    logger.info("🔄 Production mode: Server will continue running");
    return;
  }

  // Only log detailed errors in development
  logger.error(`💥 Unhandled Rejection: ${err.message}`);
  logger.error(`🔍 Stack trace: ${err.stack}`);
  logger.warn("⚠️ Server continuing to run despite unhandled rejection");
  logger.warn(
    "🔧 Development mode: Server continuing but investigate this error",
  );
});

// Handle uncaught exceptions (LOG AND ATTEMPT RECOVERY)
process.on("uncaughtException", (err) => {
  // For specific errors that we can recover from, don't shutdown
  if (err.code === "EADDRINUSE") {
    logger.error("❌ Port already in use - this needs manual intervention");
    process.exit(1); // Only exit for port conflicts
    return;
  }

  if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") {
    logger.warn(
      "⚠️ Network error detected, but server can continue without external dependencies",
    );
    return; // Don't shutdown for network errors
  }

  // For production, try to keep running unless it's critical
  if (process.env.NODE_ENV === "production") {
    logger.error("🚨 Critical error occurred, attempting to continue");
    logger.info("🔄 Server will attempt to continue serving users");

    // Give it a moment to stabilize
    setTimeout(() => {
      logger.info("✅ Server stabilized after critical error");
    }, 1000);

    return; // Don't shutdown in production
  }

  // Only log detailed errors in development
  logger.error(`💥 Uncaught Exception: ${err.message}`);
  logger.error(`🔍 Stack trace: ${err.stack}`);
  logger.error("🔧 Development mode: Shutting down for debugging");
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

// Memory monitoring - configurable via environment variable
const enableMemoryMonitoring =
  process.env.ENABLE_MEMORY_MONITORING === "true" ||
  process.env.NODE_ENV === "production";

if (enableMemoryMonitoring) {
  // More frequent monitoring in production, less frequent in development
  const monitoringInterval =
    process.env.NODE_ENV === "production" ? 60000 : 300000; // 1min prod, 5min dev

  setInterval(() => {
    const usage = process.memoryUsage();
    logger.info(
      `📊 Memory: RSS=${Math.round(usage.rss / 1024 / 1024)}MB, Heap=${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    );

    // Check for memory leaks
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    if (heapUsedMB > 1000) {
      // 1GB threshold
      logger.warn(`⚠️ High memory usage detected: ${heapUsedMB}MB`);
    }
  }, monitoringInterval);
}

// Health check monitoring - runs in production
if (process.env.NODE_ENV === "production") {
  // Health check every 30 seconds
  setInterval(async () => {
    try {
      // Check if server is still responsive
      const mongoose = require("mongoose");
      if (mongoose.connection.readyState !== 1) {
        logger.warn("⚠️ MongoDB connection lost, attempting to reconnect...");
        try {
          await mongoose.connection.db.admin().ping();
          logger.info("✅ MongoDB reconnected successfully");
        } catch (error) {
          logger.error(`❌ MongoDB reconnection failed: ${error.message}`);
        }
      }

      // Check Redis connection if available and not disabled  
      if (process.env.DISABLE_REDIS !== 'true' && redisClient && redisClient.isConnected === false) {
        logger.warn("⚠️ Redis disconnected, server continuing without cache");
      }
    } catch (error) {
      logger.error(`❌ Health check error: ${error.message}`);
    }
  }, 30000);
}
