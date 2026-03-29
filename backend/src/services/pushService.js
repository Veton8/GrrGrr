const { Expo } = require('expo-server-sdk');
const { sqlite } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const expo = new Expo();

// Map notification types to user preference keys
const PREF_KEY_MAP = {
  like: 'likes',
  comment: 'comments',
  new_follower: 'new_followers',
  live_started: 'live_started',
  gift_received: 'gifts',
  mention: 'mentions',
  direct_message: 'direct_messages',
};

/**
 * Send a push notification to a single user.
 * Also stores the notification in the in-app notification center.
 * @param {string} userId - Recipient user ID.
 * @param {{title: string, body: string, data?: Object, type?: string}} notification
 */
async function sendPushNotification(userId, { title, body, data = {}, type = 'general' }) {
  // Store in-app notification (always, regardless of push preferences)
  const notifId = uuidv4();
  sqlite
    .prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, data)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(notifId, userId, type, title, body, JSON.stringify(data));

  // Check user notification preferences
  const prefRow = sqlite
    .prepare('SELECT preferences FROM notification_preferences WHERE user_id = ?')
    .get(userId);
  if (prefRow) {
    try {
      const prefs = JSON.parse(prefRow.preferences);
      const prefKey = PREF_KEY_MAP[type];
      if (prefKey && prefs[prefKey] === false) {
        return; // User opted out of this notification type
      }
    } catch {}
  }

  // Get push tokens for this user
  const tokens = sqlite
    .prepare('SELECT token FROM push_tokens WHERE user_id = ?')
    .all(userId)
    .map((r) => r.token)
    .filter((t) => Expo.isExpoPushToken(t));

  if (tokens.length === 0) return;

  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: { ...data, type, notificationId: notifId },
  }));

  try {
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
      const result = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...result);
    }
    // Schedule receipt check (clean up invalid tokens)
    setTimeout(() => checkReceipts(tickets, userId), 15000);
  } catch (err) {
    console.error('[PushService] Send error:', err.message);
  }
}

/**
 * Send push notifications to multiple users (fan-out).
 * @param {string[]} userIds
 * @param {{title: string, body: string, data?: Object, type?: string}} notification
 */
async function sendBulkNotifications(userIds, { title, body, data = {}, type = 'general' }) {
  // Store in-app notifications for all users
  const insert = sqlite.prepare(
    `INSERT INTO notifications (id, user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const dataStr = JSON.stringify(data);
  const insertAll = sqlite.transaction(() => {
    for (const uid of userIds) {
      insert.run(uuidv4(), uid, type, title, body, dataStr);
    }
  });
  insertAll();

  // Gather all tokens
  if (userIds.length === 0) return;
  const placeholders = userIds.map(() => '?').join(',');
  const tokens = sqlite
    .prepare(`SELECT user_id, token FROM push_tokens WHERE user_id IN (${placeholders})`)
    .all(...userIds)
    .filter((r) => Expo.isExpoPushToken(r.token));

  if (tokens.length === 0) return;

  const messages = tokens.map((r) => ({
    to: r.token,
    sound: 'default',
    title,
    body,
    data: { ...data, type },
  }));

  try {
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
      const result = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...result);
    }
    setTimeout(() => checkReceipts(tickets), 15000);
  } catch (err) {
    console.error('[PushService] Bulk send error:', err.message);
  }
}

/**
 * Check push receipts and remove invalid tokens.
 * @param {Array} tickets - Expo push tickets.
 * @param {string} [userId] - Optional user context for logging.
 */
async function checkReceipts(tickets, userId) {
  const receiptIds = tickets
    .filter((t) => t.id)
    .map((t) => t.id);

  if (receiptIds.length === 0) return;

  try {
    const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    for (const chunk of chunks) {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      for (const [id, receipt] of Object.entries(receipts)) {
        if (receipt.status === 'error') {
          if (receipt.details?.error === 'DeviceNotRegistered') {
            // Find and remove the invalid token
            const ticket = tickets.find((t) => t.id === id);
            if (ticket?.to) {
              sqlite.prepare('DELETE FROM push_tokens WHERE token = ?').run(ticket.to);
              console.log('[PushService] Removed invalid token:', ticket.to);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[PushService] Receipt check error:', err.message);
  }
}

module.exports = { sendPushNotification, sendBulkNotifications };
