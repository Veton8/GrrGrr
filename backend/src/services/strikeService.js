const { sqlite } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/** Severity → duration mapping (in seconds). null = permanent. */
const DURATION_MAP = {
  warning: 0,           // No restriction
  minor: 86400,         // 24 hours
  major: 7 * 86400,     // 7 days
  critical: null,       // Permanent
};

/**
 * Issue a strike against a user and escalate their account status if needed.
 * @param {string} userId
 * @param {string} reason - Human-readable reason.
 * @param {'warning'|'minor'|'major'|'critical'} severity
 * @param {string} [contentId] - ID of the offending content (video, comment, etc.).
 * @returns {{strikeId: string, newStatus: string, totalActiveStrikes: number}}
 */
function issueStrike(userId, reason, severity, contentId = null) {
  const id = uuidv4();
  const duration = DURATION_MAP[severity];
  const expiresAt = duration
    ? new Date(Date.now() + duration * 1000).toISOString()
    : null;

  sqlite
    .prepare(
      `INSERT INTO user_strikes (id, user_id, reason, content_id, severity, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, userId, reason, contentId, severity, expiresAt);

  // Log the moderation action
  logModeration('strike_issued', userId, contentId, { severity, reason });

  // Evaluate account status
  const newStatus = evaluateAndUpdateStatus(userId);

  return { strikeId: id, newStatus, totalActiveStrikes: getActiveStrikeCount(userId) };
}

/**
 * Get the number of active (non-expired, non-warning) strikes for a user.
 * @param {string} userId
 * @returns {number}
 */
function getActiveStrikeCount(userId) {
  const row = sqlite
    .prepare(
      `SELECT COUNT(*) as count FROM user_strikes
       WHERE user_id = ? AND severity != 'warning'
         AND (expires_at IS NULL OR expires_at > datetime('now'))`
    )
    .get(userId);
  return row.count;
}

/**
 * Evaluate a user's strikes and set appropriate account status.
 * - 1 active minor+ strike → 'restricted' (can view, can't post)
 * - 2 active minor+ strikes → 'banned' (7-day ban)
 * - 3 active strikes OR 1 critical → 'banned' (permanent)
 * @param {string} userId
 * @returns {'active'|'restricted'|'banned'}
 */
function evaluateAndUpdateStatus(userId) {
  const activeCount = getActiveStrikeCount(userId);

  const hasCritical = sqlite
    .prepare(
      `SELECT 1 FROM user_strikes
       WHERE user_id = ? AND severity = 'critical'
         AND (expires_at IS NULL OR expires_at > datetime('now'))`
    )
    .get(userId);

  let newStatus = 'active';
  if (hasCritical || activeCount >= 3) {
    newStatus = 'banned';
  } else if (activeCount >= 2) {
    newStatus = 'banned';
  } else if (activeCount >= 1) {
    newStatus = 'restricted';
  }

  sqlite
    .prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newStatus, userId);

  return newStatus;
}

/**
 * Check a user's current moderation status. Returns the status string.
 * Also re-evaluates in case strikes have expired.
 * @param {string} userId
 * @returns {'active'|'restricted'|'banned'}
 */
function checkUserStatus(userId) {
  // Re-evaluate in case strikes expired
  return evaluateAndUpdateStatus(userId);
}

/**
 * Get all strikes for a user (for admin dashboard).
 * @param {string} userId
 * @returns {Array}
 */
function getUserStrikes(userId) {
  return sqlite
    .prepare(
      `SELECT id, reason, content_id, severity, created_at, expires_at
       FROM user_strikes WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(userId);
}

/**
 * Log a moderation action to the audit trail.
 * @param {string} action - e.g. 'text_blocked', 'strike_issued', 'report_reviewed'
 * @param {string} [userId] - Affected user.
 * @param {string} [contentId] - Affected content.
 * @param {Object} [details] - Additional JSON details.
 */
function logModeration(action, userId = null, contentId = null, details = {}) {
  const id = uuidv4();
  sqlite
    .prepare(
      `INSERT INTO moderation_log (id, action, user_id, content_id, details)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, action, userId, contentId, JSON.stringify(details));
}

module.exports = {
  issueStrike,
  checkUserStatus,
  getActiveStrikeCount,
  getUserStrikes,
  logModeration,
};
