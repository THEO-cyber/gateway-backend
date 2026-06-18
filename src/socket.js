// src/socket.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const logger = require("./utils/logger");

let io;

// userId (string) → Set of socketIds
const onlineUsers = new Map();

const addOnlineUser = (userId, socketId) => {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
};

const removeOnlineUser = (userId, socketId) => {
  if (!onlineUsers.has(userId)) return false;
  onlineUsers.get(userId).delete(socketId);
  if (onlineUsers.get(userId).size === 0) {
    onlineUsers.delete(userId);
    return true; // user fully offline
  }
  return false;
};

const getOnlineUserIds = () => Array.from(onlineUsers.keys());

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

  // Setup Redis adapter for horizontal scaling or enhanced memory adapter
  const setupAdapter = async () => {
    if (!redisClient || redisClient.useHybridFallback) {
      // Use enhanced memory adapter for better performance on free tier
      const EnhancedMemoryAdapter = require("./config/enhancedMemoryAdapter");
      io.adapter(EnhancedMemoryAdapter);

      logger.info(
        "📡 Socket.io using enhanced memory adapter (optimized for single-instance scaling)",
      );

      // Set up periodic cleanup for memory efficiency
      setInterval(() => {
        for (const [, namespace] of io._nsps) {
          if (
            namespace.adapter &&
            typeof namespace.adapter.cleanup === "function"
          ) {
            namespace.adapter.cleanup();
          }
        }
      }, 60000); // Cleanup every minute

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

  // Custom socket ID generator — set once, not per-connection
  io.engine.generateId = () =>
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Setup Redis adapter asynchronously
  setupAdapter();

  // Connection handling
  io.on("connection", (socket) => {
    logger.debug(`👤 Socket connected: ${socket.id}`);

    // Flutter app sends token after connecting to identify the user
    socket.on("authenticate", async (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;
        socket.userId = userId;

        addOnlineUser(userId, socket.id);

        // Update DB
        const User = require("./models/User");
        await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

        // Notify admin room
        io.to("admin-room").emit("user-online", { userId, timestamp: new Date().toISOString() });
        logger.debug(`✅ User ${userId} is now online`);
      } catch {
        logger.debug(`⚠️ Socket auth failed for ${socket.id}`);
      }
    });

    socket.on("join-room", (room) => {
      if (room && typeof room === "string" && room.length <= 100) {
        socket.join(room);
        logger.debug(`🏠 Socket ${socket.id} joined room: ${room}`);
        socket.emit("room-joined", {
          room,
          memberCount: io.sockets.adapter.rooms.get(room)?.size || 1,
        });
      }
    });

    socket.on("leave-room", (room) => {
      if (room) {
        socket.leave(room);
        logger.debug(`🚪 Socket ${socket.id} left room: ${room}`);
      }
    });

    socket.on("ping", () => {
      socket.emit("pong", { timestamp: Date.now() });
    });

    socket.on("disconnect", async (reason) => {
      logger.debug(`👋 Socket disconnected: ${socket.id} (${reason})`);

      if (socket.userId) {
        const fullyOffline = removeOnlineUser(socket.userId, socket.id);
        if (fullyOffline) {
          const User = require("./models/User");
          await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen: new Date() });
          io.to("admin-room").emit("user-offline", {
            userId: socket.userId,
            lastSeen: new Date().toISOString(),
          });
          logger.debug(`🔴 User ${socket.userId} is now offline`);
        }
      }
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
  getOnlineUserIds,
  getIO,
};
