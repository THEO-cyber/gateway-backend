require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/database");
const logger = require("./src/utils/logger");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5000;

// Create uploads directory
const uploadPath = path.join(__dirname, "uploads", "papers");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Connect to database
connectDB();

// Start server

// Socket.io integration
const httpServer = app.listen(PORT, "0.0.0.0", () => {
  logger.info(
    `🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`,
  );
  logger.info(`📁 Upload path: ${uploadPath}`);
});

// Initialize socket.io
const { initSocket } = require("./src/socket");
initSocket(httpServer);

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  httpServer.close(() => process.exit(1));
});

// Handle SIGTERM
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  httpServer.close(() => {
    logger.info("HTTP server closed");
  });
});
