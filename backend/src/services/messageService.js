const { sqlite } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { quickCheck } = require('./textModerator');

// ─── In-memory rate limiter (sliding window) ────────────────────────────────

/** @type {Map<string, number[]>} userId -> array of timestamps */
const rateLimitMap = new Map();

/** Maximum messages per window */
const RATE_LIMIT_MAX = 30;

/** Window size in milliseconds (1 minute) */
const RATE_LIMIT_WINDOW_MS = 60_000;

/** Cleanup interval for stale entries (5 minutes) */
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 300_000;

// Periodically clean up stale rate limit entries
const _cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      rateLimitMap.delete(userId);
    } else {
      rateLimitMap.set(userId, valid);
    }
  }
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);

// Allow the process to exit cleanly without this interval blocking
if (_cleanupInterval.unref) _cleanupInterval.unref();

// ─── Allowed message types ──────────────────────────────────────────────────

const ALLOWED_MESSAGE_TYPES = new Set(['text', 'image', 'video_share', 'sticker']);

/** Maximum content length for text messages */
const MAX_CONTENT_LENGTH = 1000;

// ─── Prepared statements ────────────────────────────────────────────────────

const stmts = {
  findDirectConversation: sqlite.prepare(`
    SELECT cp1.conversation_id
    FROM conversation_participants cp1
    JOIN conversation_participants cp2
      ON cp1.conversation_id = cp2.conversation_id
    JOIN conversations c
      ON c.id = cp1.conversation_id
    WHERE cp1.user_id = ?
      AND cp2.user_id = ?
      AND c.type = 'direct'
    LIMIT 1
  `),

  insertConversation: sqlite.prepare(`
    INSERT INTO conversations (id, type, created_at, updated_at)
    VALUES (?, ?, datetime('now'), datetime('now'))
  `),

  insertParticipant: sqlite.prepare(`
    INSERT INTO conversation_participants (conversation_id, user_id, joined_at, last_read_at, muted)
    VALUES (?, ?, datetime('now'), datetime('now'), 0)
  `),

  getConversation: sqlite.prepare(`
    SELECT id, type, created_at, updated_at
    FROM conversations
    WHERE id = ?
  `),

  getConversationsForUser: sqlite.prepare(`
    SELECT
      c.id,
      c.type,
      c.created_at,
      c.updated_at,
      cp.last_read_at,
      cp.muted
    FROM conversation_participants cp
    JOIN conversations c ON c.id = cp.conversation_id
    WHERE cp.user_id = ?
    ORDER BY c.updated_at DESC
  `),

  getLastMessage: sqlite.prepare(`
    SELECT
      m.id, m.type, m.content, m.media_url, m.created_at,
      m.sender_id,
      u.username AS sender_username,
      u.display_name AS sender_display_name
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?
      AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC
    LIMIT 1
  `),

  getUnreadCount: sqlite.prepare(`
    SELECT COUNT(*) AS count
    FROM messages
    WHERE conversation_id = ?
      AND sender_id != ?
      AND deleted_at IS NULL
      AND created_at > ?
  `),

  getOtherParticipants: sqlite.prepare(`
    SELECT
      u.id, u.username, u.display_name, u.avatar_url
    FROM conversation_participants cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.conversation_id = ?
      AND cp.user_id != ?
  `),

  getMessages: sqlite.prepare(`
    SELECT
      m.id, m.conversation_id, m.sender_id, m.type,
      m.content, m.media_url, m.metadata, m.created_at,
      u.username AS sender_username,
      u.display_name AS sender_display_name,
      u.avatar_url AS sender_avatar_url
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?
      AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC
    LIMIT ?
  `),

  getMessagesBefore: sqlite.prepare(`
    SELECT
      m.id, m.conversation_id, m.sender_id, m.type,
      m.content, m.media_url, m.metadata, m.created_at,
      u.username AS sender_username,
      u.display_name AS sender_display_name,
      u.avatar_url AS sender_avatar_url
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?
      AND m.deleted_at IS NULL
      AND m.created_at < ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `),

  insertMessage: sqlite.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, type, content, media_url, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `),

  updateConversationTimestamp: sqlite.prepare(`
    UPDATE conversations SET updated_at = datetime('now') WHERE id = ?
  `),

  getMessageWithSender: sqlite.prepare(`
    SELECT
      m.id, m.conversation_id, m.sender_id, m.type,
      m.content, m.media_url, m.metadata, m.created_at,
      u.username AS sender_username,
      u.display_name AS sender_display_name,
      u.avatar_url AS sender_avatar_url
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.id = ?
  `),

  markAsRead: sqlite.prepare(`
    UPDATE conversation_participants
    SET last_read_at = datetime('now')
    WHERE conversation_id = ?
      AND user_id = ?
  `),

  getMessageOwner: sqlite.prepare(`
    SELECT sender_id FROM messages WHERE id = ? AND deleted_at IS NULL
  `),

  softDeleteMessage: sqlite.prepare(`
    UPDATE messages SET deleted_at = datetime('now') WHERE id = ?
  `),

  toggleMute: sqlite.prepare(`
    UPDATE conversation_participants
    SET muted = 1 - muted
    WHERE conversation_id = ?
      AND user_id = ?
  `),

  getMuted: sqlite.prepare(`
    SELECT muted
    FROM conversation_participants
    WHERE conversation_id = ?
      AND user_id = ?
  `),

  isParticipant: sqlite.prepare(`
    SELECT 1
    FROM conversation_participants
    WHERE conversation_id = ?
      AND user_id = ?
  `),

  getParticipantIds: sqlite.prepare(`
    SELECT user_id
    FROM conversation_participants
    WHERE conversation_id = ?
  `),

  getUserConversationIds: sqlite.prepare(`
    SELECT conversation_id
    FROM conversation_participants
    WHERE user_id = ?
  `),
};

// ─── Service functions ──────────────────────────────────────────────────────

/**
 * Get an existing direct conversation between two users, or create one.
 * @param {string} userId - The initiating user's ID.
 * @param {string} participantId - The other user's ID.
 * @returns {{ id: string, type: string, created_at: string, updated_at: string, created: boolean }}
 */
function getOrCreateDirectConversation(userId, participantId) {
  if (userId === participantId) {
    throw new Error('Cannot create a conversation with yourself');
  }

  // Check for existing direct conversation
  const existing = stmts.findDirectConversation.get(userId, participantId);

  if (existing) {
    const conversation = stmts.getConversation.get(existing.conversation_id);
    return { ...conversation, created: false };
  }

  // Create new conversation
  const conversationId = uuidv4();
  const createConversation = sqlite.transaction(() => {
    stmts.insertConversation.run(conversationId, 'direct');
    stmts.insertParticipant.run(conversationId, userId);
    stmts.insertParticipant.run(conversationId, participantId);
  });
  createConversation();

  const conversation = stmts.getConversation.get(conversationId);
  return { ...conversation, created: true };
}

/**
 * Get all conversations for a user with last message preview, unread count,
 * and other participant info.
 * @param {string} userId - The user's ID.
 * @returns {Array<Object>} Conversations sorted by last activity.
 */
function getConversations(userId) {
  const conversations = stmts.getConversationsForUser.all(userId);

  return conversations.map((conv) => {
    const lastMessage = stmts.getLastMessage.get(conv.id);

    const unreadRow = stmts.getUnreadCount.get(
      conv.id,
      userId,
      conv.last_read_at || '1970-01-01T00:00:00'
    );
    const unreadCount = unreadRow ? unreadRow.count : 0;

    const otherParticipants = stmts.getOtherParticipants.all(conv.id, userId);

    return {
      id: conv.id,
      type: conv.type,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      muted: conv.muted === 1,
      last_read_at: conv.last_read_at,
      unread_count: unreadCount,
      last_message: lastMessage || null,
      participants: otherParticipants,
    };
  });
}

/**
 * Get messages for a conversation with cursor-based pagination.
 * @param {string} conversationId - The conversation ID.
 * @param {string|null} before - ISO timestamp cursor; fetch messages before this time.
 * @param {number} [limit=30] - Maximum number of messages to return.
 * @returns {Array<Object>} Messages in reverse chronological order.
 */
function getMessages(conversationId, before = null, limit = 30) {
  const safeLimit = Math.min(Math.max(1, limit), 100);

  let rows;
  if (before) {
    rows = stmts.getMessagesBefore.all(conversationId, before, safeLimit);
  } else {
    rows = stmts.getMessages.all(conversationId, safeLimit);
  }

  return rows.map((row) => ({
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    type: row.type,
    content: row.content,
    media_url: row.media_url,
    metadata: safeParseJSON(row.metadata),
    created_at: row.created_at,
    sender: {
      username: row.sender_username,
      display_name: row.sender_display_name,
      avatar_url: row.sender_avatar_url,
    },
  }));
}

/**
 * Send a message in a conversation.
 * @param {string} conversationId - The conversation ID.
 * @param {string} senderId - The sender's user ID.
 * @param {{ type?: string, content?: string, mediaUrl?: string, metadata?: Object }} options
 * @returns {Object} The full message with sender info.
 * @throws {Error} On validation failure.
 */
function sendMessage(conversationId, senderId, { type = 'text', content = '', mediaUrl = null, metadata = {} } = {}) {
  // Validate message type
  if (!ALLOWED_MESSAGE_TYPES.has(type)) {
    throw new Error(`Invalid message type: ${type}. Allowed: ${[...ALLOWED_MESSAGE_TYPES].join(', ')}`);
  }

  // Validate content length for text messages
  if (type === 'text') {
    if (!content || content.trim().length === 0) {
      throw new Error('Text messages must have content');
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      throw new Error(`Message content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`);
    }
  }

  // Apply text moderation for text messages
  let finalContent = content;
  if (type === 'text' && content) {
    const { cleaned } = quickCheck(content);
    finalContent = cleaned;
  }

  const messageId = uuidv4();
  const metadataStr = JSON.stringify(metadata || {});

  sqlite.transaction(() => {
    stmts.insertMessage.run(messageId, conversationId, senderId, type, finalContent, mediaUrl, metadataStr);
    stmts.updateConversationTimestamp.run(conversationId);
  })();

  const message = stmts.getMessageWithSender.get(messageId);
  if (!message) {
    throw new Error('Failed to retrieve sent message');
  }

  return {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_id: message.sender_id,
    type: message.type,
    content: message.content,
    media_url: message.media_url,
    metadata: safeParseJSON(message.metadata),
    created_at: message.created_at,
    sender: {
      username: message.sender_username,
      display_name: message.sender_display_name,
      avatar_url: message.sender_avatar_url,
    },
  };
}

/**
 * Mark a conversation as read for a user.
 * Updates the last_read_at timestamp to now.
 * @param {string} conversationId - The conversation ID.
 * @param {string} userId - The user's ID.
 */
function markAsRead(conversationId, userId) {
  stmts.markAsRead.run(conversationId, userId);
}

/**
 * Soft-delete a message. Only the sender may delete their own messages.
 * @param {string} messageId - The message ID.
 * @param {string} userId - The requesting user's ID.
 * @throws {Error} If message not found or user is not the sender.
 */
function softDeleteMessage(messageId, userId) {
  const row = stmts.getMessageOwner.get(messageId);

  if (!row) {
    throw new Error('Message not found');
  }

  if (row.sender_id !== userId) {
    throw new Error('Only the sender can delete this message');
  }

  stmts.softDeleteMessage.run(messageId);
}

/**
 * Toggle the muted state for a conversation participant.
 * @param {string} conversationId - The conversation ID.
 * @param {string} userId - The user's ID.
 * @returns {{ muted: boolean }} The new muted state.
 */
function toggleMute(conversationId, userId) {
  stmts.toggleMute.run(conversationId, userId);
  const row = stmts.getMuted.get(conversationId, userId);
  return { muted: row ? row.muted === 1 : false };
}

/**
 * Check if a user is a participant in a conversation.
 * @param {string} conversationId - The conversation ID.
 * @param {string} userId - The user's ID.
 * @returns {boolean}
 */
function isParticipant(conversationId, userId) {
  const row = stmts.isParticipant.get(conversationId, userId);
  return !!row;
}

/**
 * Get all participant user IDs for a conversation.
 * @param {string} conversationId - The conversation ID.
 * @returns {string[]} Array of user IDs.
 */
function getParticipantIds(conversationId) {
  return stmts.getParticipantIds.all(conversationId).map((r) => r.user_id);
}

/**
 * Get all conversation IDs for a user.
 * @param {string} userId - The user's ID.
 * @returns {string[]} Array of conversation IDs.
 */
function getUserConversationIds(userId) {
  return stmts.getUserConversationIds.all(userId).map((r) => r.conversation_id);
}

/**
 * Check if the user is within the message rate limit.
 * Uses a sliding window of 30 messages per 60 seconds.
 * @param {string} userId - The user's ID.
 * @returns {boolean} true if the message is allowed, false if rate-limited.
 */
function checkMessageRateLimit(userId) {
  const now = Date.now();
  let timestamps = rateLimitMap.get(userId);

  if (!timestamps) {
    timestamps = [];
    rateLimitMap.set(userId, timestamps);
  }

  // Remove expired timestamps
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0] <= cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }

  timestamps.push(now);
  return true;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Safely parse a JSON string, returning an empty object on failure.
 * @param {string} str
 * @returns {Object}
 */
function safeParseJSON(str) {
  try {
    return JSON.parse(str || '{}');
  } catch {
    return {};
  }
}

module.exports = {
  getOrCreateDirectConversation,
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  softDeleteMessage,
  toggleMute,
  isParticipant,
  getParticipantIds,
  getUserConversationIds,
  checkMessageRateLimit,
  // Exported for testing
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
};
