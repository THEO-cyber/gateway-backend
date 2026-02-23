const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  let token;

  // Get token from headers (support common client formats)
  if (req.headers.authorization) {
    const authHeader = req.headers.authorization.trim();

    if (authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      // Support raw token format: Authorization: <jwt>
      token = authHeader;
    }
  } else if (req.headers["x-access-token"]) {
    token = String(req.headers["x-access-token"]).trim();
  } else if (req.headers["token"]) {
    token = String(req.headers["token"]).trim();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, token failed",
    });
  }
};
