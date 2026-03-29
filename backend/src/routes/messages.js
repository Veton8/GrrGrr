const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireActiveUser } = require('../middleware/moderation');
const { sendPushNotification } = require('../services/pushService');
const {
  getOrCreateDirectConversation,
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  softDeleteMessage,
  toggleMute,
  isParticipant,
  getParticipantIds,
  checkMessageRateLimit,
} = require('../services/messageService');

// All routes require authentication
router.use(authenticate);

/**
 * POST / — Create or get an existing direct conversation.
 * Body: { participantId: string }
 * Returns the conversation object.
 */
router.post('/', async (req, res) => {
  try {
    const { participantId } = req.body;
    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required' });
    }

    const conversation = getOrCreateDirectConversation(req.user.id, participantId);
    res.status(conversation.created ? 201 : 200).json(conversation);
  } catch (err) {
    console.error('[Messages] Create conversation error:', err.message);
    if (err.message.includes('Cannot create a conversation with yourself')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * GET / — List the authenticated user's conversations.
 * Returns conversations with last message preview, unread count, and participant info.
 */
router.get('/', (req, res) => {
  try {
    const conversations = getConversations(req.user.id);
    res.json(conversations);
  } catch (err) {
    console.error('[Messages] List conversations error:', err.message);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

/**
 * GET /:id/messages — Get messages for a conversation.
 * Query: ?before=ISO_timestamp&limit=30
 * Requires the user to be a participant.
 */
router.get('/:id/messages', (req, res) => {
  try {
    const { id } = req.params;

    if (!isParticipant(id, req.user.id)) {
      return res.status(403).json({ error: 'You are not a participant in this conversation' });
    }

    const { before, limit } = req.query;
    const parsedLimit = limit ? parseInt(limit, 10) : 30;
    const messages = getMessages(id, before || null, parsedLimit);
    res.json(messages);
  } catch (err) {
    console.error('[Messages] Get messages error:', err.message);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

/**
 * POST /:id/messages — Send a message in a conversation.
 * Body: { type?: string, content?: string, mediaUrl?: string, metadata?: object }
 * Requires the user to be a participant.
 * Applies rate limiting and moderation.
 * Emits Socket.io event and sends push notifications.
 */
router.post('/:id/messages', requireActiveUser, async (req, res) => {
  try {
    const { id: conversationId } = req.params;

    // Verify participant
    if (!isParticipant(conversationId, req.user.id)) {
      return res.status(403).json({ error: 'You are not a participant in this conversation' });
    }

    // Check rate limit
    if (!checkMessageRateLimit(req.user.id)) {
      return res.status(429).json({ error: 'Too many messages. Please wait before sending more.' });
    }

    const { type, content, mediaUrl, metadata } = req.body;

    const message = sendMessage(conversationId, req.user.id, {
      type,
      content,
      mediaUrl,
      metadata,
    });

    // Emit Socket.io event to the conversation room
    const io = req.app.get('io');
    if (io) {
      const messagesNsp = io.of('/messages');
      messagesNsp.to(`dm:${conversationId}`).emit('dm:message', message);
    }

    // Send push notifications to other participants not currently in the room
    const participantIds = getParticipantIds(conversationId);
    for (const participantId of participantIds) {
      if (participantId === req.user.id) continue;

      // Check if user is in the Socket.io room
      let isOnline = false;
      if (io) {
        const { isUserInRoom } = require('../websocket');
        isOnline = isUserInRoom(io.of('/messages'), `dm:${conversationId}`, participantId);
      }

      if (!isOnline) {
        try {
          await sendPushNotification(participantId, {
            title: message.sender.display_name || message.sender.username,
            body: type === 'text' ? content.substring(0, 100) : `Sent a ${type}`,
            data: { conversationId, messageId: message.id },
            type: 'direct_message',
          });
        } catch (pushErr) {
          console.error('[Messages] Push notification error:', pushErr.message);
        }
      }
    }

    res.status(201).json(message);
  } catch (err) {
    console.error('[Messages] Send message error:', err.message);
    if (err.message.includes('Invalid message type') ||
        err.message.includes('must have content') ||
        err.message.includes('exceeds maximum length')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * PATCH /:id/read — Mark a conversation as read.
 * Requires the user to be a participant.
 */
router.patch('/:id/read', (req, res) => {
  try {
    const { id } = req.params;

    if (!isParticipant(id, req.user.id)) {
      return res.status(403).json({ error: 'You are not a participant in this conversation' });
    }

    markAsRead(id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Messages] Mark as read error:', err.message);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

/**
 * DELETE /messages/:msgId — Soft-delete a message.
 * Only the sender can delete their own message.
 */
router.delete('/messages/:msgId', (req, res) => {
  try {
    const { msgId } = req.params;
    softDeleteMessage(msgId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Messages] Delete message error:', err.message);
    if (err.message === 'Message not found') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('Only the sender')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

/**
 * POST /:id/mute — Toggle mute for a conversation.
 * Requires the user to be a participant.
 */
router.post('/:id/mute', (req, res) => {
  try {
    const { id } = req.params;

    if (!isParticipant(id, req.user.id)) {
      return res.status(403).json({ error: 'You are not a participant in this conversation' });
    }

    const result = toggleMute(id, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[Messages] Toggle mute error:', err.message);
    res.status(500).json({ error: 'Failed to toggle mute' });
  }
});

module.exports = router;
