/**
 * Engagement Tracker Service
 * Tracks video views, watch duration, and updates user interest profiles.
 */
const { sqlite } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// In-memory debounce map: `${userId}:${videoId}` → timestamp
const viewDebounce = new Map();
const DEBOUNCE_MS = 30 * 1000; // 30 seconds

/**
 * Parse hashtags from a caption string.
 * @param {string} caption - Video caption text
 * @returns {string[]} Array of lowercase hashtag names (without #)
 */
function parseHashtags(caption) {
  if (!caption) return [];
  const matches = caption.match(/#(\w+)/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}

/**
 * Link hashtags to a video. Creates hashtag records if they don't exist.
 * Called when a video is uploaded.
 * @param {string} videoId
 * @param {string} caption
 */
function linkVideoHashtags(videoId, caption) {
  const tags = parseHashtags(caption);
  if (tags.length === 0) return;

  const upsertHashtag = sqlite.prepare(
    `INSERT INTO hashtags (id, name, video_count, total_engagement, trending_score)
     VALUES (?, ?, 1, 0, 0)
     ON CONFLICT(name) DO UPDATE SET video_count = video_count + 1, updated_at = datetime('now')`
  );
  const linkTag = sqlite.prepare(
    `INSERT OR IGNORE INTO video_hashtags (video_id, hashtag_id) VALUES (?, ?)`
  );
  const getHashtag = sqlite.prepare(`SELECT id FROM hashtags WHERE name = ?`);

  const tx = sqlite.transaction(() => {
    for (const tag of tags) {
      const id = uuidv4();
      upsertHashtag.run(id, tag);
      const row = getHashtag.get(tag);
      if (row) {
        linkTag.run(videoId, row.id);
      }
    }
  });
  tx();
}

/**
 * Record a video view event with engagement tracking.
 * Debounces: only one view per user per video per 30 seconds.
 * @param {string} userId
 * @param {string} videoId
 * @param {number} watchDurationMs - How long the user watched in milliseconds
 * @param {string} source - Where the view came from ('fyp'|'following'|'profile'|'search'|'share')
 * @returns {{ recorded: boolean, completionRate: number }}
 */
function recordView(userId, videoId, watchDurationMs, source = 'fyp') {
  // Debounce check
  const key = `${userId}:${videoId}`;
  const now = Date.now();
  const lastView = viewDebounce.get(key);
  if (lastView && now - lastView < DEBOUNCE_MS) {
    return { recorded: false, completionRate: 0 };
  }
  viewDebounce.set(key, now);

  // Get video duration
  const video = sqlite.prepare('SELECT duration, caption FROM videos WHERE id = ?').get(videoId);
  if (!video) return { recorded: false, completionRate: 0 };

  const videoDurationMs = (video.duration || 0) * 1000;
  const completionRate = videoDurationMs > 0
    ? Math.min(watchDurationMs / videoDurationMs, 1.0)
    : 0;
  const replayed = videoDurationMs > 0 && watchDurationMs > videoDurationMs ? 1 : 0;

  // Insert view record
  const id = uuidv4();
  sqlite.prepare(
    `INSERT INTO video_views (id, user_id, video_id, watch_duration_ms, video_duration_ms, completion_rate, source, replayed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, videoId, watchDurationMs, videoDurationMs, completionRate, source, replayed);

  // Increment view_count on video
  sqlite.prepare('UPDATE videos SET view_count = view_count + 1 WHERE id = ?').run(videoId);

  // Update user interests based on hashtags
  updateUserInterests(userId, videoId, completionRate);

  return { recorded: true, completionRate };
}

/**
 * Update user interest scores based on video hashtags and engagement.
 * Each hashtag on the video gets a score bump weighted by completion rate.
 * @param {string} userId
 * @param {string} videoId
 * @param {number} completionRate - 0.0 to 1.0
 */
function updateUserInterests(userId, videoId, completionRate) {
  // Get hashtags for this video
  const tags = sqlite.prepare(
    `SELECT h.name FROM video_hashtags vh JOIN hashtags h ON vh.hashtag_id = h.id WHERE vh.video_id = ?`
  ).all(videoId);

  if (tags.length === 0) return;

  const upsert = sqlite.prepare(
    `INSERT INTO user_interests (user_id, hashtag, engagement_score, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, hashtag) DO UPDATE SET
       engagement_score = engagement_score + ?,
       updated_at = datetime('now')`
  );

  const tx = sqlite.transaction(() => {
    for (const { name } of tags) {
      const scoreIncrement = completionRate * 1.0; // weight factor
      upsert.run(userId, name, scoreIncrement, scoreIncrement);
    }
  });
  tx();
}

/**
 * Clean up old debounce entries (call periodically)
 */
function cleanupDebounce() {
  const cutoff = Date.now() - DEBOUNCE_MS * 2;
  for (const [key, timestamp] of viewDebounce) {
    if (timestamp < cutoff) viewDebounce.delete(key);
  }
}

// Clean up debounce map every 5 minutes (unref so it doesn't keep process alive)
const cleanupTimer = setInterval(cleanupDebounce, 5 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

module.exports = {
  parseHashtags,
  linkVideoHashtags,
  recordView,
  updateUserInterests,
};
