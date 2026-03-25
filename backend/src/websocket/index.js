const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { redisClient } = require('../config/redis');
const { sqlite } = require('../config/database');

function setupWebSocket(server) {
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      socket.user = null;
      return next();
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: decoded.userId, username: decoded.username };
      next();
    } catch {
      socket.user = null;
      next();
    }
  });

  // Live stream namespace
  const liveNsp = io.of('/live');

  liveNsp.on('connection', (socket) => {
    // Join a livestream room
    socket.on('join-stream', async (streamId) => {
      socket.join(streamId);
      const count = await redisClient.incr(`live:${streamId}:viewers`);
      try {
        sqlite.prepare('UPDATE livestreams SET viewer_count = ? WHERE id = ?').run(count, streamId);
      } catch (e) { /* ignore */ }
      liveNsp.to(streamId).emit('viewer-count', { streamId, count });
    });

    // Leave a livestream room
    socket.on('leave-stream', async (streamId) => {
      socket.leave(streamId);
      const count = await redisClient.decr(`live:${streamId}:viewers`);
      const safeCount = Math.max(0, count);
      try {
        sqlite.prepare('UPDATE livestreams SET viewer_count = ? WHERE id = ?').run(safeCount, streamId);
      } catch (e) { /* ignore */ }
      liveNsp.to(streamId).emit('viewer-count', { streamId, count: safeCount });
    });

    // Live chat message
    socket.on('chat-message', (data) => {
      if (!socket.user) return;
      liveNsp.to(data.streamId).emit('chat-message', {
        id: Date.now().toString(),
        userId: socket.user.id,
        username: socket.user.username,
        message: data.message,
        timestamp: new Date().toISOString(),
      });
    });

    // Gift sent event
    socket.on('gift-sent', (data) => {
      if (!socket.user) return;
      liveNsp.to(data.streamId).emit('gift-received', {
        senderId: socket.user.id,
        senderUsername: socket.user.username,
        giftId: data.giftId,
        giftName: data.giftName,
        giftIcon: data.giftIcon,
        animationUrl: data.animationUrl,
        quantity: data.quantity,
        timestamp: new Date().toISOString(),
      });
    });

    // Battle events
    socket.on('battle-update', (data) => {
      liveNsp.to(data.streamId).emit('battle-update', {
        battleId: data.battleId,
        creatorAScore: data.creatorAScore,
        creatorBScore: data.creatorBScore,
        timeRemaining: data.timeRemaining,
      });
    });

    socket.on('disconnect', async () => {
      const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
      for (const streamId of rooms) {
        const count = await redisClient.decr(`live:${streamId}:viewers`);
        const safeCount = Math.max(0, count);
        liveNsp.to(streamId).emit('viewer-count', { streamId, count: safeCount });
      }
    });
  });

  return io;
}

module.exports = setupWebSocket;
