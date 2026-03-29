const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { redisClient } = require('../config/redis');
const { sqlite } = require('../config/database');
const { quickCheck } = require('../services/textModerator');

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

    // Live chat message — with profanity filtering
    socket.on('chat-message', (data) => {
      if (!socket.user) return;
      const { cleaned } = quickCheck(data.message);
      liveNsp.to(data.streamId).emit('chat-message', {
        id: Date.now().toString(),
        userId: socket.user.id,
        username: socket.user.username,
        message: cleaned,
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

  // ─── Direct Messages namespace ──────────────────────────────────────────────
  const messagesNsp = io.of('/messages');

  messagesNsp.use((socket, next) => {
    if (!socket.user) return next(new Error('Authentication required'));
    next();
  });

  messagesNsp.on('connection', (socket) => {
    const userId = socket.user.id;

    // Join all conversation rooms this user participates in
    try {
      const { getUserConversationIds } = require('../services/messageService');
      const conversationIds = getUserConversationIds(userId);
      for (const convId of conversationIds) {
        socket.join(`dm:${convId}`);
      }
    } catch (err) {
      console.error('[WS/Messages] Failed to join conversation rooms:', err.message);
    }

    // dm:typing — notify other participants that this user is typing
    socket.on('dm:typing', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`dm:${conversationId}`).emit('dm:typing', {
        conversationId,
        userId,
        username: socket.user.username,
      });
    });

    // dm:stop_typing — notify other participants that this user stopped typing
    socket.on('dm:stop_typing', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`dm:${conversationId}`).emit('dm:stop_typing', {
        conversationId,
        userId,
      });
    });

    // dm:join — join a new conversation room (e.g. after creating a new conversation)
    socket.on('dm:join', ({ conversationId }) => {
      if (!conversationId) return;
      socket.join(`dm:${conversationId}`);
    });
  });

  return io;
}

/**
 * Check if a user has any active socket in a specific room within a namespace.
 * Used to determine if push notification should be sent.
 * @param {import('socket.io').Namespace} nsp - The Socket.io namespace.
 * @param {string} room - The room name (e.g. 'dm:<conversationId>').
 * @param {string} userId - The user ID to check for.
 * @returns {boolean} True if the user has at least one socket in the room.
 */
function isUserInRoom(nsp, room, userId) {
  try {
    const roomSockets = nsp.adapter.rooms.get(room);
    if (!roomSockets) return false;

    for (const socketId of roomSockets) {
      const socket = nsp.sockets.get(socketId);
      if (socket && socket.user && socket.user.id === userId) {
        return true;
      }
    }
  } catch {
    // If anything fails, assume user is not in the room
  }
  return false;
}

module.exports = setupWebSocket;
module.exports.isUserInRoom = isUserInRoom;
