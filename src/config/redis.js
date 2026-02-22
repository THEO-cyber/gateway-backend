const Redis = require("ioredis");
const hybridCache = require("./hybridCache");
const logger = require("../utils/logger");

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.useHybridFallback = false;
  }

  async connect() {
    // Skip Redis entirely if disabled - use hybrid cache
    if (process.env.DISABLE_REDIS === 'true') {
      logger.info("💾 Redis disabled - Using high-performance hybrid cache system");
      this.isConnected = null; // Set to null to indicate disabled state
      this.useHybridFallback = true;
      return false;
    }

    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || "localhost",
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        maxRetriesPerRequest: 1, // Reduce retries to prevent endless loops
        retryDelayOnFailover: 100,
        lazyConnect: true,
        keepAlive: 30000,
        maxmemoryPolicy: "allkeys-lru",
        connectTimeout: 5000, // 5 second timeout
        commandTimeout: 2000, // 2 second command timeout
      };

      // Add URL connection for Railway/cloud providers
      if (process.env.REDIS_URL) {
        this.client = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 1, // Reduce retries
          retryDelayOnFailover: 100,
          lazyConnect: true,
          connectTimeout: 5000,
          commandTimeout: 2000,
        });
      } else {
        this.client = new Redis(redisConfig);
      }

      // Event handlers
      this.client.on("connect", () => {
        this.isConnected = true;
        logger.info("✅ Redis connected successfully");
        logger.info(`💾 Redis caching: enabled`);

        // Trigger rate limiter upgrade if available
        if (global.setupRateLimiter) {
          global.setupRateLimiter();
        }
      });

      this.client.on("error", (error) => {
        this.isConnected = false;

        // Only log detailed errors in development
        if (process.env.NODE_ENV === "development") {
          logger.warn(`⚠️ Redis error: ${error.message}`);
        } else {
          logger.warn("⚠️ Redis connection issue");
        }

        // NEVER let Redis errors crash the server
        if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
          logger.info("💾 Server continuing without Redis cache");
        } else if (error.message.includes("max retries")) {
          logger.info(
            "💾 Redis retry limit reached, server continuing without cache",
          );
        } else {
          logger.info(
            "💾 Redis issue detected, server will continue without caching",
          );
        }

        // Suppress any potential unhandled rejections from Redis
        error.handled = true;
      });

      this.client.on("close", () => {
        this.isConnected = false;
        logger.warn("⚠️ Redis connection closed");
      });

      this.client.on("reconnecting", () => {
        logger.info("🔄 Redis reconnecting...");
      });

      this.client.on("end", () => {
        this.isConnected = false;
        logger.warn("⚠️ Redis connection ended");
      });

      // Test connection with timeout and proper error handling
      try {
        await Promise.race([
          this.client.ping(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Redis ping timeout")), 5000),
          ),
        ]);
        logger.info("🔗 Redis connection established");
      } catch (pingError) {
        logger.warn(
          `⚠️ Redis ping failed: ${pingError.message}, continuing without Redis`,
        );
        this.isConnected = false;
        return null;
      }

      return this.client;
    } catch (error) {
      logger.error(`❌ Failed to connect to Redis: ${error.message}`);
      this.isConnected = false;
      // Don't throw error, allow app to work without Redis
      return null;
    }
  }

  // Cache methods with hybrid fallback handling
  async get(key) {
    // Use hybrid cache if Redis is disabled or unavailable
    if (this.useHybridFallback || !this.isConnected || !this.client) {
      return await hybridCache.get(key);
    }

    try {
      const result = await this.client.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      logger.error(`Redis GET error for key ${key}: ${error.message}`);
      // Fallback to hybrid cache on Redis error
      return await hybridCache.get(key);
    }
  }

  async set(key, value, ttl = 300) {
    // Use hybrid cache if Redis is disabled or unavailable
    if (this.useHybridFallback || !this.isConnected || !this.client) {
      return await hybridCache.set(key, value, ttl);
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      // Also set in hybrid cache for backup
      await hybridCache.set(key, value, ttl);
      return true;
    } catch (error) {
      logger.error(`Redis SET error for key ${key}: ${error.message}`);
      // Fallback to hybrid cache on Redis error
      return await hybridCache.set(key, value, ttl);
    }
  }

  async del(key) {
    // Use hybrid cache if Redis is disabled or unavailable
    if (this.useHybridFallback || !this.isConnected || !this.client) {
      return await hybridCache.del(key);
    }

    try {
      await this.client.del(key);
      // Also delete from hybrid cache
      await hybridCache.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}: ${error.message}`);
      // Fallback to hybrid cache
      return await hybridCache.del(key);
    }
  }

  async exists(key) {
    // Use hybrid cache if Redis is disabled or unavailable
    if (this.useHybridFallback || !this.isConnected || !this.client) {
      const value = await hybridCache.get(key);
      return value !== null;
    }

    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}: ${error.message}`);
      // Fallback to hybrid cache
      const value = await hybridCache.get(key);
      return value !== null;
    }
  }

  // Increment counter with TTL
  async incr(key, ttl = 3600) {
    // Use hybrid cache if Redis is disabled or unavailable
    if (this.useHybridFallback || !this.isConnected || !this.client) {
      return await hybridCache.incr(key, ttl);
    }

    try {
      const value = await this.client.incr(key);
      if (value === 1) {
        await this.client.expire(key, ttl);
      }
      // Also update hybrid cache for backup
      await hybridCache.set(key, value, ttl);
      return value;
    } catch (error) {
      logger.error(`Redis INCR error for key ${key}: ${error.message}`);
      // Fallback to hybrid cache
      return await hybridCache.incr(key, ttl);
    }
  }

  // Batch operations
  async mget(keys) {
    if (!this.isConnected || !this.client || !keys.length) return [];

    try {
      const results = await this.client.mget(keys);
      return results.map((result) => (result ? JSON.parse(result) : null));
    } catch (error) {
      logger.error(`Redis MGET error: ${error.message}`);
      return keys.map(() => null);
    }
  }

  async mset(keyValuePairs, ttl = 300) {
    if (!this.isConnected || !this.client || !keyValuePairs.length)
      return false;

    try {
      const serializedPairs = keyValuePairs
        .map(([key, value]) => [key, JSON.stringify(value)])
        .flat();

      await this.client.mset(serializedPairs);

      if (ttl) {
        const pipeline = this.client.pipeline();
        keyValuePairs.forEach(([key]) => {
          pipeline.expire(key, ttl);
        });
        await pipeline.exec();
      }

      return true;
    } catch (error) {
      logger.error(`Redis MSET error: ${error.message}`);
      return false;
    }
  }

  // Clear patterns (use with caution)
  async clearPattern(pattern) {
    // Use hybrid cache if Redis is disabled or unavailable
    if (this.useHybridFallback || !this.isConnected || !this.client) {
      return await hybridCache.clearPattern(pattern);
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      // Also clear from hybrid cache
      await hybridCache.clearPattern(pattern);
      return true;
    } catch (error) {
      logger.error(`Redis clear pattern error: ${error.message}`);
      // Fallback to hybrid cache
      return await hybridCache.clearPattern(pattern);
    }
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.client) return false;

      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return {
        connected: this.isConnected,
        latency,
        memory: await this.client.memory("usage"),
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
      };
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

// Create singleton instance
const redisClient = new RedisClient();

module.exports = redisClient;
