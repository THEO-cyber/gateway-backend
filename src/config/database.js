const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    // Optimized MongoDB connection options for scalability
    const options = {
      // Connection pooling options
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 2,
      maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME) || 30000,
      serverSelectionTimeoutMS:
        parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 5000,

      // Connection behavior
      connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT) || 10000,
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,

      // Topology options
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,

      // Write concern for performance
      writeConcern: {
        w: process.env.NODE_ENV === "production" ? "majority" : 1,
        j: process.env.NODE_ENV === "production",
        wtimeout: 5000,
      },

      // Read preference for scalability
      readPreference:
        process.env.NODE_ENV === "production"
          ? "secondaryPreferred"
          : "primary",

      // Buffer settings (removed deprecated options)
      bufferCommands: false,
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    // Only log in development
    if (process.env.NODE_ENV === "development") {
      logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
      logger.info(`📊 Database: ${conn.connection.name}`);
      logger.info(
        `🔧 Pool Size: ${options.maxPoolSize} max, ${options.minPoolSize} min`,
      );
    } else {
      logger.info("✅ Database connection established");
    }

    // Connection event handlers for monitoring
    mongoose.connection.on("connected", () => {
      logger.info("📡 Mongoose connected to MongoDB");
    });

    mongoose.connection.on("error", (err) => {
      logger.error(`❌ Mongoose connection error: ${err.message}`);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("⚠️ Mongoose disconnected from MongoDB");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("🔄 Mongoose reconnected to MongoDB");
    });

    // Handle app termination
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      logger.info("📴 MongoDB connection closed due to app termination");
      process.exit(0);
    });

    return conn;
  } catch (error) {
    logger.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// Additional database utilities for monitoring
const getConnectionStatus = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return {
    state: states[state],
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    poolSize: mongoose.connection.db?.serverConfig?.poolSize || "unknown",
  };
};

const getDbStats = async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) return null;

    const stats = await db.stats();
    return {
      collections: stats.collections,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexes: stats.indexes,
      indexSize: stats.indexSize,
      avgObjSize: stats.avgObjSize,
    };
  } catch (error) {
    logger.error(`Failed to get DB stats: ${error.message}`);
    return null;
  }
};

module.exports = {
  connectDB,
  getConnectionStatus,
  getDbStats,
};
