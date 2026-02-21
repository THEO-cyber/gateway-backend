#!/usr/bin/env node
require("dotenv").config();
const mongoose = require("mongoose");
const logger = require("../src/utils/logger");

// Import models to register indexes
require("../src/models/User");
require("../src/models/Subscription");
require("../src/models/Course");
require("../src/models/Payment");
require("../src/models/Test");
require("../src/models/Question");
require("../src/models/Answer");
require("../src/models/Announcement");

async function setupIndexes() {
  try {
    logger.info("🔧 Setting up database indexes...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("✅ Connected to MongoDB");

    // Ensure all indexes are created
    await mongoose.connection.db.admin().command({ listCollections: 1 });

    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();

    for (const collection of collections) {
      const collectionName = collection.name;
      const model =
        mongoose.models[collectionName] ||
        mongoose.models[collectionName.slice(0, -1)];

      if (model) {
        logger.info(`🏗️ Creating indexes for ${collectionName}...`);
        await model.createIndexes();
      }
    }

    logger.info("✅ All indexes created successfully");

    // List created indexes
    const db = mongoose.connection.db;
    const collections2 = await db.listCollections().toArray();
    let totalIndexes = 0;

    for (const collection of collections2) {
      const indexes = await db.collection(collection.name).indexes();
      totalIndexes += indexes.length;
      logger.info(`📊 ${collection.name}: ${indexes.length} indexes`);
    }

    logger.info(`📈 Total indexes: ${totalIndexes}`);

    process.exit(0);
  } catch (error) {
    logger.error("❌ Failed to setup indexes:", error.message);
    process.exit(1);
  }
}

setupIndexes();
