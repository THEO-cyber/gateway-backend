const rateLimit = require("express-rate-limit");
const NodeCache = require("node-cache");
const crypto = require("crypto");
const logger = require("../utils/logger");

/**
 * Enhanced Rate Limiter for free tier hosting without Redis
 * Provides distributed-like rate limiting with memory storage
 */

class SmartRateLimiter {
  constructor() {
    // In-memory store for rate limiting
    this.memoryStore = new NodeCache({
      stdTTL: 900, // 15 minutes default
      checkperiod: 60, // Cleanup every minute
      useClones: false,
    });

    // Track rate limiting statistics
    this.stats = {
      blocked: 0,
      allowed: 0,
      errors: 0,
    };

    logger.info(
      "🛡️ Smart rate limiter initialized - Memory-based protection active",
    );
  }

  /**
   * Create a short stable hash to avoid storing raw tokens in memory keys/logs
   */
  hashValue(value) {
    return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
  }

  /**
   * Build a rate-limit identifier that works before auth middleware runs.
   * Priority: authenticated user -> bearer token fingerprint -> IP.
   */
  getRequestIdentifier(req) {
    if (req.user && req.user.id) {
      return `user:${req.user.id}`;
    }

    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token) {
        return `token:${this.hashValue(token)}`;
      }
    }

    // Mobile clients can send a stable per-device header to avoid shared carrier NAT collisions
    const deviceId =
      req.headers?.["x-device-id"] || req.headers?.["x-client-id"];
    if (deviceId) {
      return `device:${this.hashValue(String(deviceId))}`;
    }

    // Last-resort fallback: combine IP + UA fingerprint to reduce collisions on shared mobile IPs
    const userAgent = req.get("User-Agent") || "unknown";
    return `ipua:${this.hashValue(`${req.ip}:${userAgent}`)}`;
  }

  /**
   * Create memory-based rate limit store
   */
  createMemoryStore() {
    return {
      incr: (key, callback) => {
        try {
          const current = this.memoryStore.get(key) || 0;
          const newValue = current + 1;

          // Set with TTL if it's a new key
          if (current === 0) {
            this.memoryStore.set(key, newValue, 900); // 15 minutes
          } else {
            this.memoryStore.set(key, newValue);
          }

          callback(null, newValue, 900000); // Return count and TTL in ms
        } catch (error) {
          this.stats.errors++;
          callback(error);
        }
      },

      decrement: (key) => {
        const current = this.memoryStore.get(key) || 0;
        if (current > 0) {
          this.memoryStore.set(key, current - 1);
        }
      },

      resetKey: (key) => {
        this.memoryStore.del(key);
      },

      resetAll: () => {
        this.memoryStore.flushAll();
      },
    };
  }

  /**
   * Create general rate limiter middleware
   */
  createGeneralLimiter(options = {}) {
    const config = {
      windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
      max: options.max || 100,
      message: options.message || {
        success: false,
        message: "Too many requests from this client, please try again later.",
        retryAfter: Math.ceil((options.windowMs || 900000) / 1000),
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.createMemoryStore(),
      keyGenerator: (req) => {
        // Avoid shared mobile carrier IP collisions by using token fingerprint when available
        return `${this.getRequestIdentifier(req)}:general`;
      },
      skip: (req) => {
        // Skip rate limiting for health/preflight/static traffic
        return (
          req.method === "OPTIONS" ||
          req.path === "/health" ||
          req.path === "/keepalive" ||
          req.path === "/metrics" ||
          req.path.startsWith("/static/")
        );
      },
      handler: (req, res) => {
        this.stats.blocked++;
        logger.warn(`🚫 Rate limit exceeded for ${req.ip} on ${req.path}`);
        res.status(429).json(config.message);
      },
    };

    const limiter = rateLimit(config);

    // Wrap to track allowed requests
    return (req, res, next) => {
      limiter(req, res, (err) => {
        if (!err) {
          this.stats.allowed++;
        }
        next(err);
      });
    };
  }

  /**
   * Create strict rate limiter for sensitive endpoints
   */
  createStrictLimiter(options = {}) {
    const config = {
      windowMs: options.windowMs || 5 * 60 * 1000, // 5 minutes
      max: options.max || 5,
      message: {
        success: false,
        message: "Too many attempts. Please wait before trying again.",
        retryAfter: Math.ceil((options.windowMs || 300000) / 1000),
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.createMemoryStore(),
      keyGenerator: (req) => {
        return `${this.getRequestIdentifier(req)}:strict:${req.route?.path || req.path}`;
      },
      handler: (req, res) => {
        this.stats.blocked++;
        logger.warn(
          `🔴 Strict rate limit exceeded for ${req.ip} on ${req.path}`,
        );
        res.status(429).json(config.message);
      },
    };

    return rateLimit(config);
  }

  /**
   * Create per-user rate limiter
   */
  createUserLimiter(options = {}) {
    const userLimits = new Map();

    return (req, res, next) => {
      if (!req.user || !req.user.id) {
        return next();
      }

      const userId = req.user.id;
      const now = Date.now();
      const windowMs = options.windowMs || 60 * 1000; // 1 minute
      const maxRequests = options.max || 30;

      if (!userLimits.has(userId)) {
        userLimits.set(userId, { count: 0, resetTime: now + windowMs });
      }

      const userLimit = userLimits.get(userId);

      // Reset if window expired
      if (now >= userLimit.resetTime) {
        userLimit.count = 0;
        userLimit.resetTime = now + windowMs;
      }

      userLimit.count++;

      if (userLimit.count > maxRequests) {
        this.stats.blocked++;
        logger.warn(`👤 User rate limit exceeded for user ${userId}`);
        return res.status(429).json({
          success: false,
          message: "Too many requests. Please slow down.",
          retryAfter: Math.ceil((userLimit.resetTime - now) / 1000),
        });
      }

      this.stats.allowed++;
      next();
    };
  }

  /**
   * Smart cleanup to prevent memory leaks
   */
  cleanup() {
    const before = this.memoryStore.keys().length;

    // NodeCache automatically handles TTL cleanup, but we can force it
    this.memoryStore.flushStats();

    const after = this.memoryStore.keys().length;

    if (before !== after) {
      logger.debug(
        `🧹 Rate limiter cleanup: ${before - after} expired entries removed`,
      );
    }
  }

  /**
   * Get rate limiting statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeKeys: this.memoryStore.keys().length,
      memoryUsage: process.memoryUsage().heapUsed,
      type: "smart_memory_limiter",
    };
  }

  /**
   * Health check for rate limiter
   */
  healthCheck() {
    try {
      const stats = this.getStats();

      return {
        healthy: true,
        type: "smart_rate_limiter",
        activeKeys: stats.activeKeys,
        blocked: stats.blocked,
        allowed: stats.allowed,
        hitRate:
          stats.blocked + stats.allowed > 0
            ? ((stats.allowed / (stats.blocked + stats.allowed)) * 100).toFixed(
                2,
              ) + "%"
            : "100%",
      };
    } catch (error) {
      return {
        healthy: false,
        type: "smart_rate_limiter",
        error: error.message,
      };
    }
  }
}

// Create singleton instance
const smartLimiter = new SmartRateLimiter();

// Periodic cleanup
setInterval(
  () => {
    smartLimiter.cleanup();
  },
  5 * 60 * 1000,
); // Every 5 minutes

module.exports = smartLimiter;
