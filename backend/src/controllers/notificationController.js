const { sqlite } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ─── Push Token Management ──────────────────────────────────────────────────

/** POST /api/notifications/push-token — Register a push token for the current user. */
async function registerPushToken(req, res, next) {
  try {
    const { token, platform = 'unknown' } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Push token is required' });
    }

    // Upsert: if the token already exists for this user, update the timestamp
    const existing = sqlite
      .prepare('SELECT id FROM push_tokens WHERE user_id = ? AND token = ?')
      .get(req.user.id, token);

    if (existing) {
      sqlite
        .prepare("UPDATE push_tokens SET updated_at = datetime('now'), platform = ? WHERE id = ?")
        .run(platform, existing.id);
    } else {
      sqlite
        .prepare('INSERT INTO push_tokens (id, user_id, token, platform) VALUES (?, ?, ?, ?)')
        .run(uuidv4(), req.user.id, token, platform);
    }

    res.json({ message: 'Push token registered' });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/notifications/push-token — Unregister a push token (e.g., on logout). */
async function unregisterPushToken(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Push token is required' });
    }
    sqlite
      .prepare('DELETE FROM push_tokens WHERE user_id = ? AND token = ?')
      .run(req.user.id, token);
    res.json({ message: 'Push token removed' });
  } catch (err) {
    next(err);
  }
}

// ─── Notification Center ────────────────────────────────────────────────────

/** GET /api/notifications — List in-app notifications for the current user. */
async function getNotifications(req, res, next) {
  try {
    const { page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;

    const rows = sqlite
      .prepare(
        `SELECT id, type, title, body, data, is_read, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(req.user.id, parseInt(limit), parseInt(offset));

    const unreadCount = sqlite
      .prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0')
      .get(req.user.id).count;

    const notifications = rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: JSON.parse(n.data || '{}'),
      isRead: !!n.is_read,
      createdAt: n.created_at,
    }));

    res.json({ notifications, unreadCount, page: parseInt(page), hasMore: rows.length === parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/notifications/:notifId/read — Mark a single notification as read. */
async function markAsRead(req, res, next) {
  try {
    const { notifId } = req.params;
    sqlite
      .prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?")
      .run(notifId, req.user.id);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
}

/** POST /api/notifications/read-all — Mark all notifications as read. */
async function markAllAsRead(req, res, next) {
  try {
    sqlite
      .prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0")
      .run(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
}

// ─── Notification Preferences ───────────────────────────────────────────────

const DEFAULT_PREFERENCES = {
  likes: true,
  comments: true,
  new_followers: true,
  live_started: true,
  gifts: true,
  mentions: true,
  direct_messages: true,
};

/** GET /api/notifications/preferences — Get notification preferences. */
async function getPreferences(req, res, next) {
  try {
    const row = sqlite
      .prepare('SELECT preferences FROM notification_preferences WHERE user_id = ?')
      .get(req.user.id);

    const prefs = row ? JSON.parse(row.preferences) : DEFAULT_PREFERENCES;
    res.json({ preferences: { ...DEFAULT_PREFERENCES, ...prefs } });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/notifications/preferences — Update notification preferences. */
async function updatePreferences(req, res, next) {
  try {
    const { preferences } = req.body;
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'preferences object is required' });
    }

    // Merge with defaults to ensure all keys exist
    const existing = sqlite
      .prepare('SELECT preferences FROM notification_preferences WHERE user_id = ?')
      .get(req.user.id);

    const current = existing ? JSON.parse(existing.preferences) : DEFAULT_PREFERENCES;
    const merged = { ...DEFAULT_PREFERENCES, ...current, ...preferences };
    const prefsJson = JSON.stringify(merged);

    if (existing) {
      sqlite
        .prepare("UPDATE notification_preferences SET preferences = ?, updated_at = datetime('now') WHERE user_id = ?")
        .run(prefsJson, req.user.id);
    } else {
      sqlite
        .prepare('INSERT INTO notification_preferences (id, user_id, preferences) VALUES (?, ?, ?)')
        .run(uuidv4(), req.user.id, prefsJson);
    }

    res.json({ preferences: merged });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerPushToken,
  unregisterPushToken,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
  DEFAULT_PREFERENCES,
};
