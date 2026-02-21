const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const path = require("path");
const redisClient = require("./config/redis");
const performanceMonitor = require("./utils/performanceMonitor");
const logger = require("./utils/logger");
const {
  securityLogger,
  detectAttackPatterns,
} = require("./middleware/security");

const app = express();
app.set("trust proxy", 1); // Fix for rate-limit warning

// Test email route (Resend integration)
app.use("/api/test-email", require("./routes/testEmail"));

// Security middleware
app.use(helmet());
app.use(compression());

// CORS - Allow admin panel domain
app.use(
  cors({
    origin: [
      "https://hndgatewayadminpanel.kesug.com",
      "http://hndgatewayadminpanel.kesug.com",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:5500",
      "http://localhost:5500",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Rate limiting middleware - will be setup after Redis connects
let rateLimiterMiddleware = (req, res, next) => {
  // Temporary rate limiter until Redis is ready
  const tempLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 500,
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === "/health" || req.path === "/metrics",
  });

  return tempLimiter(req, res, next);
};

// Function to setup Redis-based rate limiter
const setupRateLimiter = () => {
  const config = {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 500,
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === "/health" || req.path === "/metrics",
  };

  if (redisClient && redisClient.isConnected) {
    try {
      const { RedisStore } = require("rate-limit-redis");
      config.store = new RedisStore({
        sendCommand: (...args) => redisClient.client.call(...args),
      });

      const redisLimiter = rateLimit(config);

      // Replace the middleware function
      rateLimiterMiddleware = (req, res, next) => {
        return redisLimiter(req, res, next);
      };

      logger.info("✅ Rate limiter upgraded to Redis store");
    } catch (error) {
      logger.warn(
        "⚠️ Rate limiter Redis setup failed, using memory store:",
        error.message,
      );
    }
  } else {
    logger.info("📡 Rate limiter using memory store (Redis not available)");
  }
};

// Make setup function globally available for Redis callback
global.setupRateLimiter = setupRateLimiter;

// Apply rate limiter middleware
app.use("/api", (req, res, next) => rateLimiterMiddleware(req, res, next));

// Performance monitoring
app.use(performanceMonitor.trackRequestPerformance());

// Prometheus metrics (production only)
if (
  process.env.NODE_ENV === "production" &&
  performanceMonitor.prometheusMiddleware
) {
  app.use(performanceMonitor.prometheusMiddleware);
}

// Body parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Security: Prevent NoSQL injection attacks
app.use(mongoSanitize());

// Security: Attack pattern detection
app.use(detectAttackPatterns);

// Security: Enhanced logging
app.use(securityLogger);

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Static files - serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/users", require("./routes/users"));
app.use("/api/papers", require("./routes/papers"));
app.use("/api/qa", require("./routes/qa"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/content", require("./routes/content")); // Unified content route (admin)
app.use("/api/departments", require("./routes/departments")); // Public departments
app.use("/api/courses", require("./routes/publicCourses")); // Public courses with subscription
app.use("/api/subjects", require("./routes/content")); // Backward compatibility
app.use("/api/tags", require("./routes/content")); // Backward compatibility
app.use("/api/announcements", require("./routes/announcements"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/tests", require("./routes/tests")); // Tests & quizzes
app.use("/api/study-materials", require("./routes/studyMaterials")); // Study materials
app.use("/api/content/materials", require("./routes/studyMaterials")); // Admin panel alias
app.use("/api/students", require("./routes/students")); // Student profiles

// Payment route
app.use("/api/payment", require("./routes/payment"));

// Subscription routes
app.use("/api/subscriptions", require("./routes/subscriptions"));

// Health check with detailed system status
app.get("/health", async (req, res) => {
  try {
    const health = await performanceMonitor.performHealthCheck();
    const status = {
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      health,
    };

    // Return 503 if critical components are unhealthy
    const isHealthy = health?.database?.healthy && health?.memory?.healthy;
    res.status(isHealthy ? 200 : 503).json(status);
  } catch (error) {
    res.status(503).json({
      status: "ERROR",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Performance metrics endpoint
app.get("/metrics", async (req, res) => {
  try {
    const report = performanceMonitor.generatePerformanceReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate metrics",
      message: error.message,
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler
app.use(require("./middleware/errorHandler"));

module.exports = app;
