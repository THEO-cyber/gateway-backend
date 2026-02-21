const logger = require("../utils/logger");

// Security middleware to prevent information leakage in production
const securityLogger = (req, res, next) => {
  // Only log detailed information in development
  if (process.env.NODE_ENV === "development") {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
    });
  } else {
    // In production, only log essential information
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

// Enhanced error logging for security incidents
const logSecurityEvent = (eventType, details, req) => {
  // Sanitize details to not expose attack patterns that could help attackers
  const sanitizedDetails = process.env.NODE_ENV === 'development' 
    ? details 
    : { 
        request: details.request,
        method: details.method,
        severity: "security"
      };

  logger.warn(`Security Event: ${eventType}`, {
    ...sanitizedDetails,
    ip: req?.ip,
    userAgent: process.env.NODE_ENV === 'development' ? req?.get("User-Agent") : "Hidden",
    timestamp: new Date().toISOString(),
    severity: "security",
  });
};

// Middleware to detect and log potential attack patterns
const detectAttackPatterns = (req, res, next) => {
  const suspiciousPatterns = [
    /(\$where|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$exists|\$regex)/i, // MongoDB injection
    /<script[^>]*>.*?<\/script>/gi, // XSS
    /(union\s+select|drop\s+table|insert\s+into|delete\s+from)/i, // SQL injection
    /(\.\.\/|\.\.\\)/g, // Path traversal
    /eval\s*\(|setTimeout\s*\(|setInterval\s*\(/i, // Code injection
  ];

  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      logSecurityEvent(
        "Potential Attack Detected",
        {
          pattern: pattern.source,
          request: req.path,
          method: req.method,
        },
        req,
      );

      return res.status(400).json({
        success: false,
        message: "Request contains invalid characters",
      });
    }
  }

  next();
};

// Rate limiting per user (in addition to IP-based limiting)
const userRateLimit = new Map();

const perUserRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    if (userRateLimit.has(userId)) {
      const userRequests = userRateLimit.get(userId);
      userRateLimit.set(
        userId,
        userRequests.filter((time) => time > windowStart),
      );
    }

    const userRequests = userRateLimit.get(userId) || [];

    if (userRequests.length >= maxRequests) {
      logSecurityEvent(
        "User Rate Limit Exceeded",
        {
          userId: userId,
          requestCount: userRequests.length,
          window: windowMs,
        },
        req,
      );

      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((userRequests[0] + windowMs - now) / 1000),
      });
    }

    userRequests.push(now);
    userRateLimit.set(userId, userRequests);

    next();
  };
};

module.exports = {
  securityLogger,
  logSecurityEvent,
  detectAttackPatterns,
  perUserRateLimit,
};
