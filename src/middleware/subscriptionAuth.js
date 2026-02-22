const User = require("../models/User");
const Subscription = require("../models/Subscription");
const redisClient = require("../config/redis");
const logger = require("../utils/logger");

// Helper function to check if Redis is available
const isRedisAvailable = () => {
  return process.env.DISABLE_REDIS !== 'true' && redisClient && redisClient.isConnected === true;
};

// Cache configuration
const CACHE_TTL = {
  USER_SUBSCRIPTION: 300, // 5 minutes
  AI_TOKENS: 60, // 1 minute
  COURSE_ACCESS: 600, // 10 minutes
};

// Helper functions for caching
const getCacheKey = (type, userId, extra = "") => {
  return `${type}:${userId}${extra ? `:${extra}` : ""}`;
};

const getCachedUserAccess = async (userId) => {
  if (!isRedisAvailable()) {
    return null; // Skip cache if Redis is disabled
  }

  const cacheKey = getCacheKey("user_access", userId);

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for user access: ${userId}`);
      return cached;
    }
  } catch (error) {
    logger.error(`Cache error: ${error.message}`);
  }

  return null;
};

const setCachedUserAccess = async (userId, userData) => {
  if (!isRedisAvailable()) {
    return; // Skip cache if Redis is disabled
  }

  const cacheKey = getCacheKey("user_access", userId);

  try {
    await redisClient.set(cacheKey, userData, CACHE_TTL.USER_SUBSCRIPTION);
    logger.debug(`Cached user access: ${userId}`);
  } catch (error) {
    logger.error(`Cache set error: ${error.message}`);
  }
};

const invalidateUserCache = async (userId) => {
  if (!isRedisAvailable()) {
    return; // Skip cache if Redis is disabled
  }

  try {
    await redisClient.clearPattern(`*:${userId}*`);
    logger.debug(`Invalidated cache for user: ${userId}`);
  } catch (error) {
    logger.error(`Cache invalidation error: ${error.message}`);
  }
};

// Optimized user access check
const getOptimizedUserAccess = async (userId) => {
  // Try cache first
  const cached = await getCachedUserAccess(userId);
  if (cached) {
    return cached;
  }

  // If not cached, fetch from database
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new Error("User not found");
  }

  // Get active subscriptions
  const activeSubscriptions = await Subscription.find({
    userId,
    status: "active",
    endDate: { $gt: new Date() },
  }).lean();

  // Build access data
  const userData = {
    id: user._id,
    accessLevel: user.accessLevel,
    aiTokens: user.aiTokens,
    subscriptions: user.subscriptions,
    activeSubscriptions,
    hasActiveSubscription: activeSubscriptions.length > 0,
    lastUpdated: Date.now(),
  };

  // Update access levels based on subscriptions
  userData.accessLevel.courses = false;
  userData.accessLevel.tests = false;
  userData.accessLevel.unlimited = false;

  for (const sub of activeSubscriptions) {
    if (sub.features?.courseAccess) {
      userData.accessLevel.courses = true;
    }
    if (sub.features?.testAccess) {
      userData.accessLevel.tests = true;
    }
    if (sub.features?.unlimitedAI) {
      userData.accessLevel.unlimited = true;
    }
  }

  // Cache the result
  await setCachedUserAccess(userId, userData);

  return userData;
};

// Middleware to check if user has access to courses
exports.requireCourseAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const courseId = req.params.courseId || req.body.courseId;

    // Get optimized user access data
    const userData = await getOptimizedUserAccess(userId);

    // Check general course access
    if (userData.accessLevel.courses) {
      req.userAccess = userData; // Pass to next middleware
      return next();
    }

    // Check specific course access if courseId is provided
    if (courseId) {
      const courseSubscription = userData.activeSubscriptions.find(
        (sub) => sub.courserId === courseId,
      );

      if (courseSubscription) {
        req.userAccess = userData;
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: "Course access required. Please subscribe to access courses.",
      requiredSubscription: "course_access",
      availablePlans: [
        {
          type: "daily",
          price: 100,
          description: "Access specific course for 1 day",
        },
        {
          type: "weekly",
          price: 500,
          description: "Access all courses for 1 week",
        },
        {
          type: "monthly",
          price: 1500,
          description: "Access all courses for 1 month",
        },
        {
          type: "four_month",
          price: 4000,
          description: "Access all courses for 4 months",
        },
      ],
    });
  } catch (error) {
    logger.error("[SubscriptionMiddleware] Course access check error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify course access",
      error: error.message,
    });
  }
};

// Middleware to check if user has access to tests
exports.requireTestAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const courseId = req.params.courseId || req.body.courseId;

    // Get optimized user access data
    const userData = await getOptimizedUserAccess(userId);

    // Check general test access
    if (userData.accessLevel.tests) {
      req.userAccess = userData;
      return next();
    }

    // Check specific course test access if courseId is provided
    if (courseId) {
      const courseSubscription = userData.activeSubscriptions.find(
        (sub) => sub.courserId === courseId && sub.features?.testAccess,
      );

      if (courseSubscription) {
        req.userAccess = userData;
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: "Test access required. Please subscribe to take tests.",
      requiredSubscription: "test_access",
      availablePlans: [
        {
          type: "daily",
          price: 100,
          description: "Access course tests for 1 day",
        },
        {
          type: "weekly",
          price: 500,
          description: "Access all tests for 1 week",
        },
        {
          type: "monthly",
          price: 1500,
          description: "Access all tests for 1 month",
        },
        {
          type: "four_month",
          price: 4000,
          description: "Access all tests for 4 months",
        },
      ],
    });
  } catch (error) {
    console.error("[SubscriptionMiddleware] Test access check error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify test access",
      error: error.message,
    });
  }
};

// Middleware to check and consume AI tokens
exports.requireAIAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get optimized user access data
    const userData = await getOptimizedUserAccess(userId);

    // Check if user has unlimited AI access
    if (userData.accessLevel.unlimited) {
      req.userAccess = userData;
      return next();
    }

    // Check if user can use AI tokens
    if (userData.aiTokens.used < userData.aiTokens.limit) {
      // Update AI token usage with atomic operation
      const tokenCacheKey = getCacheKey("ai_tokens", userId);
      let currentTokens = userData.aiTokens.used;
      
      if (isRedisAvailable()) {
        currentTokens = (await redisClient.get(tokenCacheKey)) || userData.aiTokens.used;
      }

      if (currentTokens >= userData.aiTokens.limit) {
        return res.status(403).json({
          success: false,
          message:
            "AI token limit exceeded. Upgrade to continue using AI features.",
          tokensUsed: currentTokens,
          tokenLimit: userData.aiTokens.limit,
          requiredSubscription: "ai_access",
          availablePlans: [
            {
              type: "ai_monthly",
              price: 500,
              description: "Unlimited AI access for 1 month",
            },
          ],
        });
      }

      // Increment tokens in cache and schedule DB update
      let newTokenCount = currentTokens + 1;
      if (isRedisAvailable()) {
        newTokenCount = await redisClient.incr(
          tokenCacheKey,
          CACHE_TTL.AI_TOKENS,
        );
      }

      // Schedule async DB update (non-blocking)
      setImmediate(async () => {
        try {
          await User.findByIdAndUpdate(userId, {
            $inc: { "aiTokens.used": 1 },
            $set: { "aiTokens.lastUsed": new Date() },
          });
          await invalidateUserCache(userId);
        } catch (error) {
          logger.error(`Failed to update AI tokens in DB: ${error.message}`);
        }
      });

      // Add remaining tokens info to request
      req.aiTokensRemaining = userData.aiTokens.limit - newTokenCount;
      req.aiTokensUsed = newTokenCount;
      req.userAccess = userData;

      return next();
    }

    return res.status(403).json({
      success: false,
      message:
        "AI token limit exceeded. Upgrade to continue using AI features.",
      tokensUsed: userData.aiTokens.used,
      tokenLimit: userData.aiTokens.limit,
      requiredSubscription: "ai_access",
      availablePlans: [
        {
          type: "ai_monthly",
          price: 500,
          description: "Unlimited AI access for 1 month",
        },
      ],
    });
  } catch (error) {
    logger.error("[SubscriptionMiddleware] AI access check error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify AI access",
      error: error.message,
    });
  }
};

// Middleware to check enrollment access (for course enrollment)
exports.requireEnrollmentAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const courseId = req.params.courseId || req.body.courseId;

    // Get optimized user access data
    const userData = await getOptimizedUserAccess(userId);

    // Check if user has general course access
    if (userData.accessLevel.courses) {
      req.userAccess = userData;
      return next();
    }

    // For course-specific enrollment, check if they need to pay for this specific course
    if (courseId) {
      const existingEnrollment = userData.activeSubscriptions.find(
        (sub) => sub.courserId === courseId,
      );

      if (existingEnrollment) {
        req.userAccess = userData;
        return next();
      }

      // Allow enrollment but require payment for this specific course
      req.requiresCoursePayment = true;
      req.courseId = courseId;
      req.userAccess = userData;
      return next();
    }

    return res.status(403).json({
      success: false,
      message:
        "Enrollment requires subscription. Please choose a plan to continue.",
      requiredSubscription: "enrollment_access",
      availablePlans: [
        {
          type: "daily",
          price: 100,
          description: "Access specific course for 1 day",
        },
        {
          type: "weekly",
          price: 200,
          description: "Enroll in all courses for 1 week",
        },
        {
          type: "monthly",
          price: 500,
          description: "Enroll in all courses for 1 month",
        },
        {
          type: "four_month",
          price: 1500,
          description: "Enroll in all courses for 4 months",
        },
      ],
    });
  } catch (error) {
    console.error(
      "[SubscriptionMiddleware] Enrollment access check error:",
      error,
    );
    return res.status(500).json({
      success: false,
      message: "Failed to verify enrollment access",
      error: error.message,
    });
  }
};

// Middleware to check if user is admin or has access
exports.requireAdminOrAccess = (service) => {
  return async (req, res, next) => {
    try {
      // Check if user is admin
      if (req.user.role === "admin") {
        return next();
      }

      // Check subscription access for regular users
      const userId = req.user.id;
      const userData = await getOptimizedUserAccess(userId);

      if (userData.accessLevel[service]) {
        req.userAccess = userData;
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Admin privileges or ${service} subscription required.`,
        requiredSubscription: service,
      });
    } catch (error) {
      console.error(
        `[SubscriptionMiddleware] Admin or ${service} access check error:`,
        error,
      );
      return res.status(500).json({
        success: false,
        message: `Failed to verify ${service} access`,
        error: error.message,
      });
    }
  };
};

// Update user subscription status (middleware for routes that should refresh status)
exports.updateSubscriptionStatus = async (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      // Invalidate cache to force refresh on next access
      await invalidateUserCache(req.user.id);
    }
    next();
  } catch (error) {
    logger.error(
      "[SubscriptionMiddleware] Update subscription status error:",
      error,
    );
    // Don't block the request, just log the error
    next();
  }
};

// Lightweight expired subscription check (now handled by background jobs)
exports.checkExpiredSubscriptions = async (req, res, next) => {
  try {
    // Background jobs now handle heavy operations
    // This middleware just ensures cache invalidation for expired items
    let lastCheck = null;
    if (isRedisAvailable()) {
      lastCheck = await redisClient.get("last_expiry_check");
    }
    const now = Date.now();

    if (isRedisAvailable() && (!lastCheck || now - lastCheck > 60000)) {
      // Check every minute
      await redisClient.set("last_expiry_check", now, 60);

      // Trigger background cleanup if needed (non-blocking)
      setImmediate(async () => {
        try {
          const { subscriptionQueue } = require("../services/queueService");
          await subscriptionQueue.add(
            "expire-subscriptions",
            {},
            { delay: 1000 },
          );
        } catch (error) {
          logger.error("Failed to queue subscription cleanup:", error.message);
        }
      });
    }

    next();
  } catch (error) {
    logger.error(
      "[SubscriptionMiddleware] Check expired subscriptions error:",
      error,
    );
    // Don't block the request
    next();
  }
};

module.exports = exports;
