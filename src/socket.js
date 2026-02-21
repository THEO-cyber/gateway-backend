// src/socket.js
const { Server } = require("socket.io");
const logger = require("./utils/logger");

let io;

function initSocket(server, redisClient) {
  io = new Server(server, {
    cors: {
      origin: [
        "https://hndgatewayadminpanel.kesug.com",
        "http://hndgatewayadminpanel.kesug.com",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
      ],
      credentials: true,
    },
    // Performance optimizations for scalability
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
    allowEIO3: true,
  });

  // Setup Redis adapter for horizontal scaling
  // Set up Redis adapter asynchronously after Redis connects
  const setupRedisAdapter = async () => {
    if (!redisClient) {
      logger.info("📡 Socket.io using memory adapter (Redis not configured)");
      return;
    }

    // Wait for Redis connection with timeout
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Redis connection timeout")), 10000),
    );

    try {
      // Wait for Redis to connect or timeout after 10 seconds
      await Promise.race([
        new Promise((resolve) => {
          if (redisClient.isConnected) {
            resolve();
          } else {
            const checkConnection = setInterval(() => {
              if (redisClient.isConnected) {
                clearInterval(checkConnection);
                resolve();
              }
            }, 100);
          }
        }),
        timeout,
      ]);

      const { createAdapter } = require("@socket.io/redis-adapter");

      // Use the existing Redis client for Socket.io adapter
      const pubClient = redisClient.client.duplicate();
      const subClient = redisClient.client.duplicate();

      // Add error handlers
      pubClient.on("error", (err) => {
        logger.warn(`Socket.io Redis pub client error: ${err.message}`);
      });

      subClient.on("error", (err) => {
        logger.warn(`Socket.io Redis sub client error: ${err.message}`);
      });

      // Connect the clients
      await Promise.all([pubClient.connect(), subClient.connect()]);

      // Setup the adapter
      io.adapter(createAdapter(pubClient, subClient));
      logger.info("✅ Socket.io Redis adapter configured for scaling");
    } catch (error) {
      logger.info("📡 Socket.io using memory adapter (Redis not available)");
    }
  };

  // Setup Redis adapter asynchronously
  setupRedisAdapter();

  // Connection handling with performance monitoring
  io.on("connection", (socket) => {
    logger.info(`👤 User connected: ${socket.id}`);

    // Track connection metrics
    io.engine.generateId = (req) => {
      return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };

    // Listen for join-room event from client (specialty/department)
    socket.on("join-room", (room) => {
      if (room) {
        socket.join(room);
        logger.info(`🏠 User ${socket.id} joined room: ${room}`);

        // Emit room statistics
        socket.emit("room-joined", {
          room,
          memberCount: io.sockets.adapter.rooms.get(room)?.size || 1,
        });
      }
    });

    // Handle leave room
    socket.on("leave-room", (room) => {
      if (room) {
        socket.leave(room);
        logger.info(`🚪 User ${socket.id} left room: ${room}`);
      }
    });

    // Handle ping for connection health
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: Date.now() });
    });

    socket.on("disconnect", (reason) => {
      logger.info(`👋 User disconnected: ${socket.id} (Reason: ${reason})`);
    });

    // Handle connection errors
    socket.on("error", (error) => {
      logger.error(`🚨 Socket error for ${socket.id}:`, error.message);
    });
  });

  // Monitor socket.io performance
  setInterval(() => {
    const stats = {
      connectedClients: io.engine.clientsCount,
      rooms: io.sockets.adapter.rooms.size,
      timestamp: new Date().toISOString(),
    };

    if (stats.connectedClients > 100) {
      logger.info(
        `📊 Socket.io stats: ${stats.connectedClients} clients, ${stats.rooms} rooms`,
      );
    }
  }, 60000); // Every minute
}

function sendMessageToUser(userId, message) {
  if (io) {
    io.to(userId).emit("admin-message", {
      ...message,
      timestamp: new Date().toISOString(),
      serverId: process.env.SERVER_ID || "server-1",
    });
    logger.info(`📤 Message sent to user ${userId}`);
  }
}

function broadcastToRoom(room, event, data) {
  if (io) {
    io.to(room).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
      serverId: process.env.SERVER_ID || "server-1",
    });
    logger.info(`📢 Broadcast to room ${room}: ${event}`);
  }
}

function getSocketStats() {
  if (!io) return null;

  return {
    connectedClients: io.engine.clientsCount,
    rooms: Array.from(io.sockets.adapter.rooms.keys()),
    roomCounts: Object.fromEntries(
      Array.from(io.sockets.adapter.rooms.entries()).map(([room, sockets]) => [
        room,
        sockets.size,
      ]),
    ),
  };
}

function getIO() {
  return io;
}

module.exports = {
  initSocket,
  sendMessageToUser,
  broadcastToRoom,
  getSocketStats,
  getIO,
};
