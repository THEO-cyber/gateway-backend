// Queue Service - Simplified version for development without Redis dependency

const logger = require("../utils/logger");

/**
 * Simple queue service that works without Redis
 * This provides the same interface as Bull queues but processes jobs immediately
 */

// Simple dummy queue implementation
class SimpleQueue {
  constructor(name) {
    this.name = name;
    this.processors = new Map();
  }

  process(jobName, processor) {
    this.processors.set(jobName, processor);
  }

  async add(jobName, data, options = {}) {
    logger.info(`📦 Queue job added: ${this.name} - ${jobName}`);
    // Process job immediately in development
    const processor = this.processors.get(jobName);
    if (processor) {
      try {
        await processor({ data });
      } catch (error) {
        logger.warn(`⚠️ Queue job failed: ${jobName}`, error.message);
      }
    }
    return { id: Date.now() };
  }

  on(event, callback) {
    // No-op for events in development mode
  }

  async isReady() {
    return true;
  }

  async getJobCounts() {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    };
  }
}

// Create queue instances
const subscriptionQueue = new SimpleQueue("subscription processing");
const tokenQueue = new SimpleQueue("token processing");
const emailQueue = new SimpleQueue("email processing");

// Set up job processors with simplified logic
subscriptionQueue.process("checkSubscriptionExpiry", async (job) => {
  try {
    logger.info("📅 Running subscription expiry check...");

    const Subscription = require("../models/Subscription");
    const User = require("../models/User");

    const expiredSubscriptions = await Subscription.find({
      status: "active",
      endDate: { $lt: new Date() },
    });

    for (const subscription of expiredSubscriptions) {
      await Subscription.findByIdAndUpdate(subscription._id, {
        status: "expired",
      });

      await User.findByIdAndUpdate(subscription.userId, {
        hasActiveSubscription: false,
      });

      logger.info(`💼 Subscription expired: ${subscription._id}`);
    }

    logger.info(
      `✅ Processed ${expiredSubscriptions.length} expired subscriptions`,
    );
  } catch (error) {
    logger.error(`❌ Subscription cleanup error: ${error.message}`);
  }
});

tokenQueue.process("refreshUserTokens", async (job) => {
  try {
    logger.info("🔄 Refreshing user tokens...");

    const User = require("../models/User");

    const usersToRefresh = await User.find({
      "tokens.expiresAt": { $lt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      hasActiveSubscription: true,
    }).limit(100);

    for (const user of usersToRefresh) {
      user.tokens = {
        used: 0,
        total: user.subscriptionTier === "premium" ? 10000 : 5000,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      await user.save();

      logger.info(`🔄 Tokens refreshed for user: ${user._id}`);
    }

    logger.info(`✅ Refreshed tokens for ${usersToRefresh.length} users`);
  } catch (error) {
    logger.error(`❌ Token refresh error: ${error.message}`);
  }
});

emailQueue.process("sendEmail", async (job) => {
  try {
    logger.info("📧 Processing email job...");

    const emailService = require("./emailService");
    const { to, subject, template, data } = job.data;

    await emailService.sendEmail(to, subject, template, data);
    logger.info(`📧 Email sent to: ${to}`);
  } catch (error) {
    logger.warn(`⚠️ Email send failed: ${error.message}`);
  }
});

// Service functions
const addToQueue = async (queueName, jobName, data, options = {}) => {
  try {
    switch (queueName) {
      case "subscription":
        return await subscriptionQueue.add(jobName, data, options);
      case "token":
        return await tokenQueue.add(jobName, data, options);
      case "email":
        return await emailQueue.add(jobName, data, options);
      default:
        logger.warn(`⚠️ Unknown queue: ${queueName}`);
        return null;
    }
  } catch (error) {
    logger.warn(`⚠️ Queue operation failed: ${error.message}`);
    return null;
  }
};

const scheduleRecurringJobs = async () => {
  try {
    logger.info("📦 Setting up recurring background jobs...");

    // Schedule subscription cleanup every hour
    setInterval(
      async () => {
        await addToQueue("subscription", "checkSubscriptionExpiry", {});
      },
      60 * 60 * 1000,
    );

    // Schedule token refresh daily
    setInterval(
      async () => {
        await addToQueue("token", "refreshUserTokens", {});
      },
      24 * 60 * 60 * 1000,
    );

    logger.info("✅ Scheduled recurring background jobs");
    return true;
  } catch (error) {
    logger.error(`❌ Failed to schedule jobs: ${error.message}`);
    return false;
  }
};

const getQueueStats = async () => {
  try {
    return {
      subscription: await subscriptionQueue.getJobCounts(),
      token: await tokenQueue.getJobCounts(),
      email: await emailQueue.getJobCounts(),
    };
  } catch (error) {
    logger.warn(`⚠️ Failed to get queue stats: ${error.message}`);
    return {
      subscription: { waiting: 0, active: 0, completed: 0, failed: 0 },
      token: { waiting: 0, active: 0, completed: 0, failed: 0 },
      email: { waiting: 0, active: 0, completed: 0, failed: 0 },
    };
  }
};

module.exports = {
  subscriptionQueue,
  tokenQueue,
  emailQueue,
  addToQueue,
  scheduleRecurringJobs,
  getQueueStats,
};
