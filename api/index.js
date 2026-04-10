// Vercel serverless entry point - optimized for Edge Functions
require("dotenv").config();

// Disable Redis for serverless (use hybrid cache)
process.env.DISABLE_REDIS = "true";

// Import the Express app
const app = require("../src/app");

// Handle database connection for serverless
const { connectDB } = require("../src/config/database");
const logger = require("../src/utils/logger");

// Initialize database connection (with caching for serverless)
let isConnected = false;

const connectToDatabase = async () => {
  if (isConnected) {
    return;
  }

  try {
    await connectDB();
    isConnected = true;
    logger.info("✅ Database connected for Vercel serverless function");
  } catch (error) {
    logger.error("❌ Database connection failed:", error.message);
    // Don't throw - let the function continue with limited functionality
  }
};

// Export the handler for Vercel
module.exports = async (req, res) => {
  try {
    // Set serverless environment
    process.env.VERCEL = "true";
    
    // Ensure database is connected
    await connectToDatabase();
    
    // Handle the request with Express app
    return app(req, res);
  } catch (error) {
    logger.error("🚨 Serverless function error:", error.message);
    
    // Return error response
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : "Something went wrong"
    });
  }
};