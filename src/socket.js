// src/socket.js
const { Server } = require("socket.io");

let io;

function initSocket(server) {
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
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Listen for join-room event from client (specialty/department)
    socket.on("join-room", (room) => {
      if (room) {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
}

function sendMessageToUser(userId, message) {
  if (io) {
    io.to(userId).emit("admin-message", message);
  }
}

function getIO() {
  return io;
}

module.exports = { initSocket, sendMessageToUser, getIO };
