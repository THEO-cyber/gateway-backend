const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");

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
  })
);

// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 500, // Increased from 100 to 500
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// Body parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
app.use("/api/courses", require("./routes/content")); // Backward compatibility
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

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
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
