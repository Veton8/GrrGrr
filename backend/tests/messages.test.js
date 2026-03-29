/**
 * Tests for the Direct Messages system: conversation management, message
 * sending/pagination, authorization, soft-delete, read receipts, rate
 * limiting, and mute toggling.
 */
require('dotenv').config();

const { v4: uuidv4 } = require('uuid');

// ─── Test helpers ───────────────────────────────────────────────────────────

let sqlite;
let messageService;

/**
 * Create a test user directly in the database.
 * @param {string} [username]
 * @returns {{ id: string, username: string }}
 */
function createTestUser(username) {
  const id = uuidv4();
  const name = username || `testuser_${id.substring(0, 8)}`;
  sqlite.prepare(
    `INSERT INTO users (id, username, password_hash, display_name)
     VALUES (?, ?, 'fakehash', ?)`
  ).run(id, name, name);
  return { id, username: name };
}

// ─── Setup & Teardown ───────────────────────────────────────────────────────

beforeAll(() => {
  jest.resetModules();

  // Import the real sqlite instance and run messaging migrations
  const db = require('../src/config/database');
  sqlite = db.sqlite;

  // Ensure the required tables exist (conversations, messages, etc.)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      bio TEXT DEFAULT '',
      coin_balance INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      is_verified INTEGER DEFAULT 0,
      is_live INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'direct',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TEXT DEFAULT (datetime('now')),
      last_read_at TEXT DEFAULT (datetime('now')),
      muted INTEGER DEFAULT 0,
      PRIMARY KEY (conversation_id, user_id)
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT DEFAULT '',
      media_url TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    )
  `);

  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`);

  messageService = require('../src/services/messageService');
});

afterAll(() => {
  // Clean up test data
  try {
    sqlite.exec(`DELETE FROM messages WHERE sender_id IN (SELECT id FROM users WHERE password_hash = 'fakehash')`);
    sqlite.exec(`DELETE FROM conversation_participants WHERE user_id IN (SELECT id FROM users WHERE password_hash = 'fakehash')`);
    sqlite.exec(`DELETE FROM conversations WHERE id NOT IN (SELECT conversation_id FROM conversation_participants)`);
    sqlite.exec(`DELETE FROM users WHERE password_hash = 'fakehash'`);
  } catch {
    // Ignore cleanup errors
  }
});

// ─── Conversation Creation ──────────────────────────────────────────────────

describe('Conversation Creation', () => {
  let userA, userB, userC;

  beforeAll(() => {
    userA = createTestUser('conv_user_a');
    userB = createTestUser('conv_user_b');
    userC = createTestUser('conv_user_c');
  });

  test('creates a new direct conversation between two users', () => {
    const conv = messageService.getOrCreateDirectConversation(userA.id, userB.id);
    expect(conv).toBeDefined();
    expect(conv.id).toBeDefined();
    expect(conv.type).toBe('direct');
    expect(conv.created).toBe(true);
  });

  test('returns existing conversation (no duplicates)', () => {
    const conv1 = messageService.getOrCreateDirectConversation(userA.id, userB.id);
    const conv2 = messageService.getOrCreateDirectConversation(userA.id, userB.id);
    expect(conv1.id).toBe(conv2.id);
    expect(conv2.created).toBe(false);
  });

  test('same two users always get the same conversation regardless of order', () => {
    const conv1 = messageService.getOrCreateDirectConversation(userA.id, userB.id);
    const conv2 = messageService.getOrCreateDirectConversation(userB.id, userA.id);
    expect(conv1.id).toBe(conv2.id);
  });

  test('different user pairs get different conversations', () => {
    const convAB = messageService.getOrCreateDirectConversation(userA.id, userB.id);
    const convAC = messageService.getOrCreateDirectConversation(userA.id, userC.id);
    expect(convAB.id).not.toBe(convAC.id);
  });

  test('cannot create a conversation with yourself', () => {
    expect(() => {
      messageService.getOrCreateDirectConversation(userA.id, userA.id);
    }).toThrow('Cannot create a conversation with yourself');
  });
});

// ─── Message Sending & Pagination ───────────────────────────────────────────

describe('Message Sending & Pagination', () => {
  let userA, userB, conversationId;

  beforeAll(() => {
    userA = createTestUser('msg_user_a');
    userB = createTestUser('msg_user_b');
    const conv = messageService.getOrCreateDirectConversation(userA.id, userB.id);
    conversationId = conv.id;
  });

  test('sends a text message successfully', () => {
    const msg = messageService.sendMessage(conversationId, userA.id, {
      type: 'text',
      content: 'Hello, world!',
    });

    expect(msg).toBeDefined();
    expect(msg.id).toBeDefined();
    expect(msg.content).toBe('Hello, world!');
    expect(msg.type).toBe('text');
    expect(msg.sender_id).toBe(userA.id);
    expect(msg.sender).toBeDefined();
    expect(msg.sender.username).toBe('msg_user_a');
  });

  test('rejects message content exceeding 1000 characters', () => {
    const longContent = 'a'.repeat(1001);
    expect(() => {
      messageService.sendMessage(conversationId, userA.id, {
        type: 'text',
        content: longContent,
      });
    }).toThrow('exceeds maximum length');
  });

  test('rejects empty text messages', () => {
    expect(() => {
      messageService.sendMessage(conversationId, userA.id, {
        type: 'text',
        content: '',
      });
    }).toThrow('must have content');
  });

  test('rejects invalid message type', () => {
    expect(() => {
      messageService.sendMessage(conversationId, userA.id, {
        type: 'invalid_type',
        content: 'test',
      });
    }).toThrow('Invalid message type');
  });

  test('allows image, video_share, and sticker types', () => {
    const imgMsg = messageService.sendMessage(conversationId, userA.id, {
      type: 'image',
      mediaUrl: 'https://example.com/image.jpg',
    });
    expect(imgMsg.type).toBe('image');

    const vidMsg = messageService.sendMessage(conversationId, userA.id, {
      type: 'video_share',
      metadata: { videoId: 'some-video-id' },
    });
    expect(vidMsg.type).toBe('video_share');

    const stickerMsg = messageService.sendMessage(conversationId, userA.id, {
      type: 'sticker',
      mediaUrl: 'https://example.com/sticker.png',
    });
    expect(stickerMsg.type).toBe('sticker');
  });

  test('cursor-based pagination returns messages in correct order', () => {
    // Send multiple messages with slight delays (use direct SQL to set timestamps)
    const conv = messageService.getOrCreateDirectConversation(
      createTestUser('pag_a').id,
      createTestUser('pag_b').id
    );
    const users = sqlite.prepare(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = ? LIMIT 1`
    ).get(conv.id);
    const senderId = users.user_id;

    // Insert messages with explicit timestamps
    for (let i = 0; i < 5; i++) {
      sqlite.prepare(
        `INSERT INTO messages (id, conversation_id, sender_id, type, content, created_at)
         VALUES (?, ?, ?, 'text', ?, datetime('2025-01-01 00:00:0' || ?))`
      ).run(uuidv4(), conv.id, senderId, `Message ${i}`, i.toString());
    }

    const allMessages = messageService.getMessages(conv.id, null, 10);
    expect(allMessages.length).toBe(5);
    // Most recent first
    expect(allMessages[0].content).toBe('Message 4');
    expect(allMessages[4].content).toBe('Message 0');

    // Paginate using cursor
    const cursor = allMessages[2].created_at; // Message 2
    const olderMessages = messageService.getMessages(conv.id, cursor, 10);
    expect(olderMessages.length).toBe(2);
    expect(olderMessages[0].content).toBe('Message 1');
    expect(olderMessages[1].content).toBe('Message 0');
  });

  test('messages exclude soft-deleted', () => {
    const userX = createTestUser('del_list_a');
    const userY = createTestUser('del_list_b');
    const conv = messageService.getOrCreateDirectConversation(userX.id, userY.id);

    const msg1 = messageService.sendMessage(conv.id, userX.id, { type: 'text', content: 'keep me' });
    const msg2 = messageService.sendMessage(conv.id, userX.id, { type: 'text', content: 'delete me' });

    messageService.softDeleteMessage(msg2.id, userX.id);

    const messages = messageService.getMessages(conv.id);
    const ids = messages.map((m) => m.id);
    expect(ids).toContain(msg1.id);
    expect(ids).not.toContain(msg2.id);
  });
});

// ─── Authorization ──────────────────────────────────────────────────────────

describe('Authorization', () => {
  let userA, userB, outsider, conversationId;

  beforeAll(() => {
    userA = createTestUser('auth_user_a');
    userB = createTestUser('auth_user_b');
    outsider = createTestUser('auth_outsider');
    const conv = messageService.getOrCreateDirectConversation(userA.id, userB.id);
    conversationId = conv.id;
  });

  test('participant check returns true for participants', () => {
    expect(messageService.isParticipant(conversationId, userA.id)).toBe(true);
    expect(messageService.isParticipant(conversationId, userB.id)).toBe(true);
  });

  test('participant check returns false for non-participants', () => {
    expect(messageService.isParticipant(conversationId, outsider.id)).toBe(false);
  });

  test('non-participant cannot access messages (verified via isParticipant guard)', () => {
    // The route uses isParticipant as a guard; test the guard logic
    const canAccess = messageService.isParticipant(conversationId, outsider.id);
    expect(canAccess).toBe(false);

    // Participants can access
    const messages = messageService.getMessages(conversationId);
    expect(Array.isArray(messages)).toBe(true);
  });
});

// ─── Soft Delete ────────────────────────────────────────────────────────────

describe('Soft Delete', () => {
  let userA, userB, conversationId;

  beforeAll(() => {
    userA = createTestUser('sdel_user_a');
    userB = createTestUser('sdel_user_b');
    const conv = messageService.getOrCreateDirectConversation(userA.id, userB.id);
    conversationId = conv.id;
  });

  test('sender can delete own message', () => {
    const msg = messageService.sendMessage(conversationId, userA.id, {
      type: 'text',
      content: 'To be deleted',
    });

    expect(() => {
      messageService.softDeleteMessage(msg.id, userA.id);
    }).not.toThrow();

    // Verify it's soft-deleted in the DB
    const row = sqlite.prepare('SELECT deleted_at FROM messages WHERE id = ?').get(msg.id);
    expect(row.deleted_at).not.toBeNull();
  });

  test('non-sender cannot delete message', () => {
    const msg = messageService.sendMessage(conversationId, userA.id, {
      type: 'text',
      content: 'Cannot delete me',
    });

    expect(() => {
      messageService.softDeleteMessage(msg.id, userB.id);
    }).toThrow('Only the sender can delete this message');
  });

  test('deleting non-existent message throws', () => {
    expect(() => {
      messageService.softDeleteMessage(uuidv4(), userA.id);
    }).toThrow('Message not found');
  });

  test('deleted message not returned in message list', () => {
    const msg = messageService.sendMessage(conversationId, userA.id, {
      type: 'text',
      content: 'Will be hidden',
    });
    messageService.softDeleteMessage(msg.id, userA.id);

    const messages = messageService.getMessages(conversationId);
    const ids = messages.map((m) => m.id);
    expect(ids).not.toContain(msg.id);
  });
});

// ─── Read Receipts ──────────────────────────────────────────────────────────

describe('Read Receipts', () => {
  let userA, userB, conversationId;

  beforeAll(() => {
    userA = createTestUser('read_user_a');
    userB = createTestUser('read_user_b');
    const conv = messageService.getOrCreateDirectConversation(userA.id, userB.id);
    conversationId = conv.id;
  });

  test('marking as read updates last_read_at', () => {
    const before = sqlite.prepare(
      `SELECT last_read_at FROM conversation_participants
       WHERE conversation_id = ? AND user_id = ?`
    ).get(conversationId, userA.id);

    // Small delay to ensure timestamp changes
    messageService.markAsRead(conversationId, userA.id);

    const after = sqlite.prepare(
      `SELECT last_read_at FROM conversation_participants
       WHERE conversation_id = ? AND user_id = ?`
    ).get(conversationId, userA.id);

    expect(after.last_read_at).toBeDefined();
    // The last_read_at should be >= the before value
    expect(after.last_read_at >= before.last_read_at).toBe(true);
  });

  test('unread count decreases after marking read', () => {
    // Set last_read_at to the past so new messages will count as unread
    sqlite.prepare(
      `UPDATE conversation_participants SET last_read_at = datetime('2020-01-01')
       WHERE conversation_id = ? AND user_id = ?`
    ).run(conversationId, userA.id);

    // Send messages from B to A
    messageService.sendMessage(conversationId, userB.id, { type: 'text', content: 'Unread 1' });
    messageService.sendMessage(conversationId, userB.id, { type: 'text', content: 'Unread 2' });

    // Check A's conversations — should have unread messages
    const convsBefore = messageService.getConversations(userA.id);
    const convBefore = convsBefore.find((c) => c.id === conversationId);
    expect(convBefore.unread_count).toBeGreaterThan(0);

    // Mark as read
    messageService.markAsRead(conversationId, userA.id);

    // Check again — unread should be 0
    const convsAfter = messageService.getConversations(userA.id);
    const convAfter = convsAfter.find((c) => c.id === conversationId);
    expect(convAfter.unread_count).toBe(0);
  });
});

// ─── Rate Limiting ──────────────────────────────────────────────────────────

describe('Rate Limiting', () => {
  test('allows up to RATE_LIMIT_MAX messages', () => {
    const userId = uuidv4(); // Use random ID so other tests don't interfere
    const max = messageService.RATE_LIMIT_MAX;

    for (let i = 0; i < max; i++) {
      expect(messageService.checkMessageRateLimit(userId)).toBe(true);
    }
  });

  test('blocks after RATE_LIMIT_MAX messages', () => {
    const userId = uuidv4();
    const max = messageService.RATE_LIMIT_MAX;

    for (let i = 0; i < max; i++) {
      messageService.checkMessageRateLimit(userId);
    }

    // The next one should be blocked
    expect(messageService.checkMessageRateLimit(userId)).toBe(false);
  });

  test('different users have independent rate limits', () => {
    const userX = uuidv4();
    const userY = uuidv4();
    const max = messageService.RATE_LIMIT_MAX;

    // Fill up userX's limit
    for (let i = 0; i < max; i++) {
      messageService.checkMessageRateLimit(userX);
    }
    expect(messageService.checkMessageRateLimit(userX)).toBe(false);

    // userY should still be allowed
    expect(messageService.checkMessageRateLimit(userY)).toBe(true);
  });
});

// ─── Mute Toggle ────────────────────────────────────────────────────────────

describe('Mute Toggle', () => {
  let userA, userB, conversationId;

  beforeAll(() => {
    userA = createTestUser('mute_user_a');
    userB = createTestUser('mute_user_b');
    const conv = messageService.getOrCreateDirectConversation(userA.id, userB.id);
    conversationId = conv.id;
  });

  test('toggles mute on', () => {
    const result = messageService.toggleMute(conversationId, userA.id);
    expect(result.muted).toBe(true);
  });

  test('toggles mute off', () => {
    // Already muted from previous test, toggle again
    const result = messageService.toggleMute(conversationId, userA.id);
    expect(result.muted).toBe(false);
  });

  test('mute state shows in conversation list', () => {
    // Mute it
    messageService.toggleMute(conversationId, userA.id);

    const convs = messageService.getConversations(userA.id);
    const conv = convs.find((c) => c.id === conversationId);
    expect(conv.muted).toBe(true);

    // Unmute for cleanup
    messageService.toggleMute(conversationId, userA.id);
  });
});

// ─── Conversation Listing ───────────────────────────────────────────────────

describe('Conversation Listing', () => {
  let userA, userB, userC;

  beforeAll(() => {
    userA = createTestUser('list_user_a');
    userB = createTestUser('list_user_b');
    userC = createTestUser('list_user_c');
  });

  test('lists conversations with participant info', () => {
    messageService.getOrCreateDirectConversation(userA.id, userB.id);
    messageService.getOrCreateDirectConversation(userA.id, userC.id);

    const convs = messageService.getConversations(userA.id);
    expect(convs.length).toBeGreaterThanOrEqual(2);

    for (const conv of convs) {
      expect(conv.participants).toBeDefined();
      expect(conv.participants.length).toBeGreaterThan(0);
      expect(conv.participants[0]).toHaveProperty('username');
    }
  });

  test('conversation list includes last message preview', () => {
    const conv = messageService.getOrCreateDirectConversation(userA.id, userB.id);
    messageService.sendMessage(conv.id, userA.id, { type: 'text', content: 'Preview text' });

    const convs = messageService.getConversations(userA.id);
    const found = convs.find((c) => c.id === conv.id);
    expect(found.last_message).not.toBeNull();
    expect(found.last_message.content).toBe('Preview text');
  });
});
