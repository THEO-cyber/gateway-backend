const { Adapter } = require("socket.io-adapter");
const logger = require("../utils/logger");

/**
 * Enhanced Memory Adapter for Socket.io
 * Provides clustering-like functionality for single-instance deployments
 * with better performance than default memory adapter
 */

class EnhancedMemoryAdapter extends Adapter {
  constructor(nsp) {
    super(nsp);
    this.rooms = new Map();
    this.sids = new Map();
    this.encoder = null;
    this.stats = {
      connections: 0,
      rooms: 0,
      broadcasts: 0,
      errors: 0,
    };

    logger.info("🔌 Enhanced Memory Adapter initialized for Socket.io scaling");
  }

  addAll(id, rooms) {
    if (!this.sids.has(id)) {
      this.sids.set(id, new Set());
      this.stats.connections++;
    }

    for (const room of rooms) {
      this.sids.get(id).add(room);

      if (!this.rooms.has(room)) {
        this.rooms.set(room, new Set());
        this.stats.rooms++;
      }
      this.rooms.get(room).add(id);
    }
  }

  del(id, room) {
    if (this.sids.has(id)) {
      this.sids.get(id).delete(room);
    }

    if (this.rooms.has(room)) {
      this.rooms.get(room).delete(id);

      if (this.rooms.get(room).size === 0) {
        this.rooms.delete(room);
        this.stats.rooms--;
      }
    }
  }

  delAll(id) {
    if (!this.sids.has(id)) {
      return;
    }

    for (const room of this.sids.get(id)) {
      if (this.rooms.has(room)) {
        this.rooms.get(room).delete(id);

        if (this.rooms.get(room).size === 0) {
          this.rooms.delete(room);
          this.stats.rooms--;
        }
      }
    }

    this.sids.delete(id);
    this.stats.connections--;
  }

  broadcast(packet, opts) {
    this.stats.broadcasts++;

    const rooms = opts.rooms;
    const except = opts.except || new Set();
    const flags = opts.flags || {};
    const packetOpts = {
      preEncoded: true,
      volatile: flags.volatile,
      compress: flags.compress,
    };

    const ids = new Set();

    if (rooms.size) {
      for (const room of rooms) {
        if (!this.rooms.has(room)) continue;

        for (const id of this.rooms.get(room)) {
          if (ids.has(id) || except.has(id)) continue;

          const socket = this.nsp.sockets.get(id);
          if (socket) {
            ids.add(id);
            socket.packet(packet, packetOpts);
          }
        }
      }
    } else {
      for (const [id] of this.sids) {
        if (except.has(id)) continue;

        const socket = this.nsp.sockets.get(id);
        if (socket) {
          socket.packet(packet, packetOpts);
        }
      }
    }
  }

  sockets(rooms) {
    const sids = new Set();

    if (rooms.size) {
      for (const room of rooms) {
        if (!this.rooms.has(room)) continue;

        for (const id of this.rooms.get(room)) {
          if (this.nsp.sockets.has(id)) {
            sids.add(id);
          }
        }
      }
    } else {
      for (const [id] of this.sids) {
        if (this.nsp.sockets.has(id)) {
          sids.add(id);
        }
      }
    }

    return Promise.resolve(sids);
  }

  socketRooms(id) {
    return this.sids.get(id) || new Set();
  }

  /**
   * Get adapter statistics for monitoring
   */
  getStats() {
    return {
      ...this.stats,
      activeConnections: this.sids.size,
      activeRooms: this.rooms.size,
      type: "enhanced_memory",
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Cleanup orphaned rooms periodically
   */
  cleanup() {
    let cleaned = 0;

    for (const [room, sids] of this.rooms.entries()) {
      // Remove disconnected sockets from rooms
      for (const sid of sids) {
        if (!this.nsp.sockets.has(sid)) {
          sids.delete(sid);
          cleaned++;
        }
      }

      // Remove empty rooms
      if (sids.size === 0) {
        this.rooms.delete(room);
        this.stats.rooms--;
      }
    }

    if (cleaned > 0) {
      logger.debug(
        `🧹 Socket.io cleanup: removed ${cleaned} orphaned connections`,
      );
    }
  }

  /**
   * Health check for the adapter
   */
  healthCheck() {
    try {
      const stats = this.getStats();

      return {
        healthy: true,
        type: "enhanced_memory_adapter",
        connections: stats.activeConnections,
        rooms: stats.activeRooms,
        broadcasts: stats.broadcasts,
        memoryUsage: stats.memoryUsage.heapUsed,
      };
    } catch (error) {
      this.stats.errors++;
      return {
        healthy: false,
        type: "enhanced_memory_adapter",
        error: error.message,
      };
    }
  }
}

module.exports = EnhancedMemoryAdapter;
