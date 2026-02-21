const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  // Only log full stack trace in development
  if (process.env.NODE_ENV === "development") {
    logger.error(err.stack);
  } else {
    logger.error(`Error: ${err.message}`);
  }

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Resource not found",
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: "Duplicate field value entered",
    });
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join(", "),
    });
  }

  // Multer file upload error
  if (err.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: "File upload error",
    });
  }

  // Generic server error response
  res.status(err.statusCode || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "development"
        ? err.message || "Server Error"
        : "Internal Server Error",
  });
};

module.exports = errorHandler;
