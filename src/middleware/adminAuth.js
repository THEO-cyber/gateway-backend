const User = require("../models/User");

// Middleware to check if user is admin
exports.isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Authorization error",
      error: error.message,
    });
  }
};

// Middleware to check if user is active and not banned
exports.isActiveUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (!req.user.isActive || req.user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended or banned",
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Authorization error",
      error: error.message,
    });
  }
};
