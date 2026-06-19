const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
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
// Trust upstream proxy chain (Render/edge proxy) so req.ip resolves to real client IP.
app.set("trust proxy", 1); // trust one upstream proxy (Render/nginx) — prevents X-Forwarded-For spoofing

// Serve app logo as favicon
app.use("/public", express.static(path.join(__dirname, "../public")));
app.get("/favicon.ico", (req, res) => res.redirect(301, "/public/favicon.png"));
app.get("/favicon.png", (req, res) => res.redirect(301, "/public/favicon.png"));

// JDoodle code execution route
app.use("/api", require("./routes/codeExecution"));

const buildRateLimitKey = (req) => {
  if (req.user && req.user.id) {
    return `user:${req.user.id}`;
  }

  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex")
        .slice(0, 16);
      return `token:${tokenHash}`;
    }
  }

  const deviceId = req.headers?.["x-device-id"] || req.headers?.["x-client-id"];
  if (deviceId) {
    const deviceHash = crypto
      .createHash("sha256")
      .update(String(deviceId))
      .digest("hex")
      .slice(0, 16);
    return `device:${deviceHash}`;
  }

  const userAgent = req.get("User-Agent") || "unknown";
  const ipUaHash = crypto
    .createHash("sha256")
    .update(`${req.ip}:${userAgent}`)
    .digest("hex")
    .slice(0, 16);
  return `ipua:${ipUaHash}`;
};

// Test email route (Resend integration)
app.use("/api/test-email", require("./routes/testEmail"));

// Security middleware
app.use(helmet());
app.use(compression());

// CORS - Allow admin panel, local dev, and local network for device testing
const localIp = process.env.LOCAL_IP || "172.25.18.55";
const defaultAllowedOrigins = [
  "https://hndgatewayadminpanel.kesug.com",
  "http://hndgatewayadminpanel.kesug.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  // Local network access for physical device testing
  `http://${localIp}`,
  `http://${localIp}:3000`,
  `http://${localIp}:5173`,
  `http://${localIp}:8080`,
  `http://${localIp}:5500`,
];

const envOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envOrigins])];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin (native mobile apps, curl, Postman, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Allow any origin on the local subnet in development (e.g. emulators, physical devices)
      if (process.env.NODE_ENV !== "production") {
        const localPatterns = [/^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/, /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/, new RegExp(`^http:\\/\\/${localIp.replace(/\./g, "\\.")}(:\\d+)?$`)];
        if (localPatterns.some((p) => p.test(origin))) return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Device-ID", "X-Client-ID"],
  }),
);

// Rate limiting middleware - will be setup after Redis connects
const tempLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 500,
  message: "Too many requests from this client, please try again later.",
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: buildRateLimitKey,
  skip: (req) =>
    req.method === "OPTIONS" ||
    req.path === "/health" ||
    req.path === "/keepalive" ||
    req.path === "/metrics",
});

let rateLimiterMiddleware = tempLimiter;

// Function to setup Redis-based rate limiter
const setupRateLimiter = () => {
  // Use smart rate limiter for better performance without Redis
  const smartLimiter = require("./config/smartRateLimiter");

  const config = {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 500,
    message: "Too many requests from this client, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: buildRateLimitKey,
    skip: (req) =>
      req.method === "OPTIONS" ||
      req.path === "/health" ||
      req.path === "/keepalive" ||
      req.path === "/metrics",
  };

  if (redisClient && redisClient.isConnected === true) {
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

      logger.info("✅ Rate limiter using Redis store");
    } catch (error) {
      logger.warn(
        "⚠️ Redis rate limiter setup failed, using smart memory limiter:",
        error.message,
      );

      // Fallback to smart memory limiter
      rateLimiterMiddleware = smartLimiter.createGeneralLimiter(config);
    }
  } else {
    // Use smart memory-based rate limiter (better than default memory store)
    rateLimiterMiddleware = smartLimiter.createGeneralLimiter(config);
    logger.info(
      "🛡️ Rate limiter using smart memory store (optimized for single-instance)",
    );
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

// DB health guard — return 503 instead of 500 when the database is down
app.use("/api", (req, res, next) => {
  const mongoose = require("mongoose");
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: "Service temporarily unavailable. Please try again shortly.",
    });
  }
  next();
});

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

// Push notifications
app.use("/api/notifications", require("./routes/notifications"));

// Payment route
app.use("/api/payment", require("./routes/payment"));

// Paper download payment routes
app.use("/api/paper-payment", require("./routes/paperPayment"));

// Subscription routes
app.use("/api/subscriptions", require("./routes/subscriptions"));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "HND Gateway Backend API",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "HND Gateway API is running",
    endpoints: {
      auth: "/api/auth",
      papers: "/api/papers",
      "paper-payment": "/api/paper-payment",
      health: "/health",
    },
  });
});

// Health check — minimal public endpoint
app.get("/health", async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const isDbHealthy = mongoose.connection.readyState === 1;
    res.status(isDbHealthy ? 200 : 503).json({
      status: isDbHealthy ? "OK" : "DEGRADED",
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({ status: "ERROR", timestamp: new Date().toISOString() });
  }
});

app.get("/keepalive", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Performance metrics endpoint — admin-only
app.get("/metrics", require("./middleware/auth").protect, require("./middleware/adminAuth").isAdmin, async (req, res) => {
  try {
    const report = performanceMonitor.generatePerformanceReport();
    res.json(report);
  } catch {
    res.status(500).json({ success: false, message: "Failed to generate metrics" });
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
