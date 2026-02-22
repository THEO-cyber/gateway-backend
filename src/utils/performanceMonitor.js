const promClient = require("prometheus-api-metrics");
const logger = require("../utils/logger");
const redisClient = require("../config/redis");
const { getConnectionStatus, getDbStats } = require("../config/database");

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requestDuration: new Map(),
      dbQueries: new Map(),
      cacheStats: {
        hits: 0,
        misses: 0,
        errors: 0,
      },
    };

    this.init();
  }

  init() {
    // Initialize Prometheus metrics
    if (process.env.NODE_ENV === "production") {
      try {
        // Use proper prometheus-api-metrics initialization
        this.prometheusMiddleware = promClient();
      } catch (error) {
        logger.warn(
          "⚠️ Prometheus metrics initialization failed, continuing without metrics",
        );
        this.prometheusMiddleware = null;
      }
    }

    // Start periodic health checks
    this.startHealthMonitoring();
  }

  // Request performance middleware
  trackRequestPerformance() {
    return (req, res, next) => {
      const start = Date.now();
      const route = `${req.method} ${req.route?.path || req.path}`;

      res.on("finish", () => {
        const duration = Date.now() - start;
        this.recordRequestMetrics(route, duration, res.statusCode);
      });

      next();
    };
  }

  recordRequestMetrics(route, duration, statusCode) {
    if (!this.metrics.requestDuration.has(route)) {
      this.metrics.requestDuration.set(route, []);
    }

    const routeMetrics = this.metrics.requestDuration.get(route);
    routeMetrics.push({ duration, statusCode, timestamp: Date.now() });

    // Keep only last 1000 requests per route
    if (routeMetrics.length > 1000) {
      routeMetrics.splice(0, routeMetrics.length - 1000);
    }

    // Log slow requests
    if (duration > 5000) {
      // 5 seconds
      logger.warn(
        `🐌 Slow request: ${route} took ${duration}ms (Status: ${statusCode})`,
      );
    }
  }

  // Database query performance tracking
  trackDbQuery(operation, collection, duration, error = null) {
    const key = `${collection}.${operation}`;

    if (!this.metrics.dbQueries.has(key)) {
      this.metrics.dbQueries.set(key, {
        count: 0,
        totalTime: 0,
        errors: 0,
        avgTime: 0,
      });
    }

    const queryMetrics = this.metrics.dbQueries.get(key);
    queryMetrics.count++;
    queryMetrics.totalTime += duration;
    queryMetrics.avgTime = queryMetrics.totalTime / queryMetrics.count;

    if (error) {
      queryMetrics.errors++;
    }

    // Log slow queries
    if (duration > 1000) {
      // 1 second
      logger.warn(
        `🐌 Slow DB query: ${key} took ${duration}ms ${error ? `(Error: ${error.message})` : ""}`,
      );
    }
  }

  // Cache performance tracking
  trackCacheOperation(operation, hit = false, error = null) {
    if (hit) {
      this.metrics.cacheStats.hits++;
    } else if (!error) {
      this.metrics.cacheStats.misses++;
    }

    if (error) {
      this.metrics.cacheStats.errors++;
    }
  }

  // Get performance summary
  getPerformanceStats() {
    const stats = {
      requests: this.getRequestStats(),
      database: this.getDbStats(),
      cache: this.getCacheStats(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    return stats;
  }

  getRequestStats() {
    const routeStats = {};

    for (const [route, metrics] of this.metrics.requestDuration) {
      const recent = metrics.filter((m) => Date.now() - m.timestamp < 300000); // Last 5 minutes

      if (recent.length > 0) {
        const durations = recent.map((m) => m.duration);
        const statusCodes = recent.reduce((acc, m) => {
          acc[m.statusCode] = (acc[m.statusCode] || 0) + 1;
          return acc;
        }, {});

        routeStats[route] = {
          count: recent.length,
          avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
          minDuration: Math.min(...durations),
          maxDuration: Math.max(...durations),
          statusCodes,
        };
      }
    }

    return routeStats;
  }

  getDbStats() {
    const queryStats = {};

    for (const [query, metrics] of this.metrics.dbQueries) {
      queryStats[query] = {
        count: metrics.count,
        avgTime: Math.round(metrics.avgTime),
        totalTime: metrics.totalTime,
        errors: metrics.errors,
        errorRate:
          metrics.count > 0
            ? ((metrics.errors / metrics.count) * 100).toFixed(2)
            : 0,
      };
    }

    return queryStats;
  }

  getCacheStats() {
    const total = this.metrics.cacheStats.hits + this.metrics.cacheStats.misses;

    return {
      hits: this.metrics.cacheStats.hits,
      misses: this.metrics.cacheStats.misses,
      errors: this.metrics.cacheStats.errors,
      hitRate:
        total > 0
          ? ((this.metrics.cacheStats.hits / total) * 100).toFixed(2)
          : 0,
      total,
    };
  }

  // Health monitoring
  startHealthMonitoring() {
    // Check system health every 60 seconds (reduced frequency)
    setInterval(async () => {
      await this.performHealthCheck();
    }, 60000);
  }

  async performHealthCheck() {
    try {
      const health = {
        database: await this.checkDatabaseHealth(),
        redis: await this.checkRedisHealth(),
        cache: await this.checkCacheHealth(),
        rateLimiter: await this.checkRateLimiterHealth(),
        memory: this.checkMemoryHealth(),
        timestamp: new Date().toISOString(),
      };

      // Log warnings for unhealthy components (except Redis if it's just not configured)
      Object.entries(health).forEach(([component, status]) => {
        if (status && status.healthy === false) {
          // Only warn about Redis if it's configured but failing, not if it's just not available
          if (
            component === "redis" &&
            (status.error === "Redis client not connected" ||
              status.status === "disabled")
          ) {
            logger.debug(
              `📡 ${component} not configured: ${status.error || status.message}`,
            );
          } else {
            logger.warn(`⚠️ Health check warning for ${component}:`, status);
          }
        }
      });

      return health;
    } catch (error) {
      logger.error("Health check failed:", error.message);
      return null;
    }
  }

  async checkDatabaseHealth() {
    try {
      const connectionStatus = getConnectionStatus();
      const dbStats = await getDbStats();

      return {
        healthy: connectionStatus.state === "connected",
        connection: connectionStatus,
        stats: dbStats,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  async checkRedisHealth() {
    try {
      // Skip Redis health check if disabled
      if (process.env.DISABLE_REDIS === "true") {
        return {
          healthy: true,
          status: "disabled",
          message: "Redis disabled by configuration",
        };
      }

      const redisClient = require("../config/redis");

      // Check if Redis client exists and is connected
      if (!redisClient || !redisClient.isConnected) {
        return {
          healthy: false,
          error: "Redis client not connected",
        };
      }

      // Try to ping Redis
      const start = Date.now();
      const pingResult = await redisClient.client.ping();
      const latency = Date.now() - start;

      return {
        healthy: pingResult === "PONG",
        latency,
        connected: redisClient.isConnected,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  checkMemoryHealth() {
    const usage = process.memoryUsage();
    const maxHeap = 1024 * 1024 * 1024; // 1GB threshold

    return {
      healthy: usage.heapUsed < maxHeap,
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024), // MB
    };
  }

  // Alert thresholds
  shouldAlert(stats) {
    const alerts = [];

    // Check response times
    Object.entries(stats.requests).forEach(([route, metrics]) => {
      if (metrics.avgDuration > 3000) {
        alerts.push(
          `High response time for ${route}: ${metrics.avgDuration}ms`,
        );
      }
    });

    // Check database performance
    Object.entries(stats.database).forEach(([query, metrics]) => {
      if (metrics.avgTime > 1000) {
        alerts.push(`Slow database query ${query}: ${metrics.avgTime}ms`);
      }
      if (metrics.errorRate > 5) {
        alerts.push(`High error rate for ${query}: ${metrics.errorRate}%`);
      }
    });

    // Check cache hit rate
    if (stats.cache.total > 100 && stats.cache.hitRate < 70) {
      alerts.push(`Low cache hit rate: ${stats.cache.hitRate}%`);
    }

    // Check memory usage
    if (stats.memory.heapUsed > 800) {
      // 800MB
      alerts.push(`High memory usage: ${stats.memory.heapUsed}MB`);
    }

    return alerts;
  }

  // Performance report
  generatePerformanceReport() {
    const stats = this.getPerformanceStats();
    const alerts = this.shouldAlert(stats);

    return {
      summary: {
        status: alerts.length === 0 ? "healthy" : "warning",
        alertCount: alerts.length,
        uptime: `${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m`,
      },
      alerts,
      stats,
      recommendations: this.generateRecommendations(stats),
    };
  }

  generateRecommendations(stats) {
    const recommendations = [];

    if (stats.cache.hitRate < 80 && stats.cache.total > 100) {
      recommendations.push(
        "Consider increasing cache TTL or improving cache key strategy",
      );
    }

    if (stats.memory.heapUsed > 500) {
      recommendations.push(
        "Monitor memory usage - consider implementing memory profiling",
      );
    }

    const slowRoutes = Object.entries(stats.requests).filter(
      ([_, metrics]) => metrics.avgDuration > 2000,
    ).length;

    if (slowRoutes > 0) {
      recommendations.push(`Optimize ${slowRoutes} slow routes identified`);
    }

    return recommendations;
  }

  // Check hybrid cache health
  async checkCacheHealth() {
    try {
      const hybridCache = require("../config/hybridCache");
      return await hybridCache.healthCheck();
    } catch (error) {
      return {
        healthy: false,
        type: "hybrid_cache",
        error: error.message,
      };
    }
  }

  // Check rate limiter health
  async checkRateLimiterHealth() {
    try {
      const smartLimiter = require("../config/smartRateLimiter");
      return smartLimiter.healthCheck();
    } catch (error) {
      return {
        healthy: false,
        type: "rate_limiter",
        error: error.message,
      };
    }
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;
