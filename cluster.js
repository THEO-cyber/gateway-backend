const cluster = require("cluster");
const numCPUs = require("os").cpus().length;
const logger = require("./src/utils/logger");

// Determine number of workers
const workers =
  process.env.CLUSTER_WORKERS === "auto"
    ? numCPUs
    : parseInt(process.env.CLUSTER_WORKERS) || numCPUs;

if (cluster.isMaster) {
  logger.info(`🚀 Master process ${process.pid} is running`);
  logger.info(`🔧 Starting ${workers} worker processes`);

  // Fork workers
  for (let i = 0; i < workers; i++) {
    cluster.fork();
  }

  // Handle worker events
  cluster.on("online", (worker) => {
    logger.info(`👷 Worker ${worker.process.pid} is online`);
  });

  cluster.on("exit", (worker, code, signal) => {
    logger.error(
      `👷 Worker ${worker.process.pid} died (${signal || code}). Restarting...`,
    );

    // Restart the worker
    setTimeout(() => {
      cluster.fork();
    }, 1000);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    logger.info("📡 SIGTERM signal received. Shutting down workers...");

    for (const id in cluster.workers) {
      cluster.workers[id].kill("SIGTERM");
    }
  });

  process.on("SIGINT", () => {
    logger.info("📡 SIGINT signal received. Shutting down workers...");

    for (const id in cluster.workers) {
      cluster.workers[id].kill("SIGTERM");
    }
  });
} else {
  // Worker process - run the server
  require("./server.js");

  logger.info(`👷 Worker ${process.pid} started`);
}
