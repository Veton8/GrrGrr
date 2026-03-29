/**
 * Search Service
 * Provides full-text search using SQLite FTS5, suggestions, and discover data.
 */
const { sqlite } = require('../config/database');

// In-memory rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10;

// In-memory suggestion cache with TTL
const suggestionCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Sanitize search input to prevent FTS5 syntax errors.
 * Strips special FTS5 characters.
 * @param {string} query - Raw search input
 * @returns {string} Sanitized query
 */
function sanitizeQuery(query) {
  if (!query) return '';
  // Remove FTS5 special characters: * " ( ) : ^ - +
  return query.replace(/[*"():^+\-{}[\]\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Check rate limit for a user.
 * @param {string} userId
 * @returns {boolean} true if within limit
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const userRecord = rateLimitMap.get(userId);

  if (!userRecord || now - userRecord.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { windowStart: now, count: 1 });
    return true;
  }

  if (userRecord.count >= RATE_LIMIT_MAX) {
    return false;
  }

  userRecord.count++;
  return true;
}

/**
 * Search videos using FTS5.
 * @param {string} query - Search query
 * @param {number} limit
 * @param {number} offset
 * @returns {Array} Video IDs
 */
function searchVideos(query, limit = 10, offset = 0) {
  const sanitized = sanitizeQuery(query);
  if (!sanitized) return [];

  // Use FTS5 MATCH with BM25 ranking
  // Add * for prefix matching
  const ftsQuery = sanitized.split(/\s+/).map(w => w + '*').join(' ');

  try {
    const rows = sqlite.prepare(
      `SELECT f.video_id as id, bm25(videos_fts) as rank
       FROM videos_fts f
       WHERE videos_fts MATCH ?
       ORDER BY rank
       LIMIT ? OFFSET ?`
    ).all(ftsQuery, limit, offset);

    return rows.map(r => r.id);
  } catch (err) {
    console.error('[Search] FTS5 video search error:', err.message);
    // Fallback to LIKE search
    return sqlite.prepare(
      `SELECT id FROM videos WHERE caption LIKE ? ORDER BY like_count DESC LIMIT ? OFFSET ?`
    ).all(`%${sanitized}%`, limit, offset).map(r => r.id);
  }
}

/**
 * Search users using FTS5.
 * @param {string} query
 * @param {number} limit
 * @param {number} offset
 * @returns {Array} User IDs
 */
function searchUsers(query, limit = 10, offset = 0) {
  const sanitized = sanitizeQuery(query);
  if (!sanitized) return [];

  const ftsQuery = sanitized.split(/\s+/).map(w => w + '*').join(' ');

  try {
    const rows = sqlite.prepare(
      `SELECT f.user_id as id, bm25(users_fts) as rank
       FROM users_fts f
       WHERE users_fts MATCH ?
       ORDER BY rank
       LIMIT ? OFFSET ?`
    ).all(ftsQuery, limit, offset);

    return rows.map(r => r.id);
  } catch (err) {
    console.error('[Search] FTS5 user search error:', err.message);
    return sqlite.prepare(
      `SELECT id FROM users WHERE username LIKE ? OR display_name LIKE ? LIMIT ? OFFSET ?`
    ).all(`%${sanitized}%`, `%${sanitized}%`, limit, offset).map(r => r.id);
  }
}

/**
 * Search hashtags by prefix match.
 * @param {string} query
 * @param {number} limit
 * @returns {Array}
 */
function searchHashtags(query, limit = 10) {
  const sanitized = sanitizeQuery(query).toLowerCase();
  if (!sanitized) return [];

  return sqlite.prepare(
    `SELECT id, name, video_count as videoCount, trending_score as trendingScore
     FROM hashtags
     WHERE name LIKE ?
     ORDER BY video_count DESC, trending_score DESC
     LIMIT ?`
  ).all(sanitized + '%', limit);
}

/**
 * Get autocomplete suggestions (users + hashtags).
 * @param {string} query - Partial query
 * @returns {Array<{type: string, text: string, id: string}>}
 */
function getSuggestions(query) {
  const sanitized = sanitizeQuery(query).toLowerCase();
  if (!sanitized || sanitized.length < 2) return [];

  // Check cache
  const cached = suggestionCache.get(sanitized);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return cached.data;
  }

  const suggestions = [];

  // Hashtag suggestions
  const hashtags = sqlite.prepare(
    `SELECT name, video_count FROM hashtags WHERE name LIKE ? ORDER BY video_count DESC LIMIT 3`
  ).all(sanitized + '%');
  for (const h of hashtags) {
    suggestions.push({ type: 'hashtag', text: '#' + h.name, id: h.name, videoCount: h.video_count });
  }

  // User suggestions
  const users = sqlite.prepare(
    `SELECT id, username, display_name, avatar_url FROM users WHERE username LIKE ? OR display_name LIKE ? LIMIT 3`
  ).all(sanitized + '%', sanitized + '%');
  for (const u of users) {
    suggestions.push({ type: 'user', text: '@' + u.username, id: u.id, displayName: u.display_name, avatarUrl: u.avatar_url });
  }

  // Cache
  const result = suggestions.slice(0, 5);
  suggestionCache.set(sanitized, { data: result, time: Date.now() });

  return result;
}

/**
 * Get discover/explore page data.
 * @returns {{ trendingHashtags: Array, popularCreators: Array, risingVideos: Array }}
 */
function getDiscoverData() {
  // Trending Hashtags — top 10 by trending_score (fallback to video_count)
  const trendingHashtags = sqlite.prepare(
    `SELECT id, name, video_count as videoCount, trending_score as trendingScore
     FROM hashtags
     ORDER BY trending_score DESC, video_count DESC
     LIMIT 10`
  ).all();

  // Popular Creators — users with most followers
  const popularCreators = sqlite.prepare(
    `SELECT u.id, u.username, u.display_name as displayName, u.avatar_url as avatarUrl,
            u.is_verified as isVerified, u.bio,
            COUNT(f.follower_id) as followerCount
     FROM users u
     LEFT JOIN followers f ON u.id = f.following_id
     GROUP BY u.id
     ORDER BY followerCount DESC
     LIMIT 10`
  ).all();

  // Rising Videos — highest score-to-age ratio (high score but posted recently)
  const risingVideos = sqlite.prepare(
    `SELECT v.id, v.video_url, v.thumbnail_url, v.hls_url, v.caption, v.duration,
            v.view_count, v.like_count, v.comment_count, v.share_count, v.created_at,
            u.id as user_id, u.username, u.display_name, u.avatar_url, u.is_verified,
            COALESCE(vs.score, 0) as score,
            COALESCE(vs.score, 0) / (1 + (julianday('now') - julianday(v.created_at)) * 24) as rising_score
     FROM videos v
     JOIN users u ON v.user_id = u.id
     LEFT JOIN video_scores vs ON v.id = vs.video_id
     ORDER BY rising_score DESC
     LIMIT 10`
  ).all();

  return { trendingHashtags, popularCreators, risingVideos };
}

/**
 * Sync a single video into the FTS index (call after video insert/update).
 * @param {string} videoId
 */
function syncVideoToFTS(videoId) {
  try {
    // Remove existing entry
    sqlite.prepare(`DELETE FROM videos_fts WHERE video_id = ?`).run(videoId);

    // Get video data
    const video = sqlite.prepare(
      `SELECT v.id, v.caption, u.username
       FROM videos v JOIN users u ON v.user_id = u.id
       WHERE v.id = ?`
    ).get(videoId);
    if (!video) return;

    // Get hashtags
    const tags = sqlite.prepare(
      `SELECT h.name FROM video_hashtags vh JOIN hashtags h ON vh.hashtag_id = h.id WHERE vh.video_id = ?`
    ).all(videoId);
    const hashtagStr = tags.map(t => t.name).join(' ');

    sqlite.prepare(
      `INSERT INTO videos_fts (video_id, caption, hashtags, username) VALUES (?, ?, ?, ?)`
    ).run(video.id, video.caption || '', hashtagStr, video.username);
  } catch (err) {
    console.error('[Search] FTS sync error for video', videoId, err.message);
  }
}

/**
 * Sync a single user into the FTS index.
 * @param {string} userId
 */
function syncUserToFTS(userId) {
  try {
    sqlite.prepare(`DELETE FROM users_fts WHERE user_id = ?`).run(userId);
    const user = sqlite.prepare('SELECT id, username, display_name, bio FROM users WHERE id = ?').get(userId);
    if (!user) return;
    sqlite.prepare(
      `INSERT INTO users_fts (user_id, username, display_name, bio) VALUES (?, ?, ?, ?)`
    ).run(user.id, user.username, user.display_name || '', user.bio || '');
  } catch (err) {
    console.error('[Search] FTS sync error for user', userId, err.message);
  }
}

// Periodic cleanup of rate limit and suggestion cache
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now - val.windowStart > RATE_LIMIT_WINDOW_MS * 2) rateLimitMap.delete(key);
  }
  for (const [key, val] of suggestionCache) {
    if (now - val.time > CACHE_TTL_MS * 2) suggestionCache.delete(key);
  }
}, 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

module.exports = {
  sanitizeQuery,
  checkRateLimit,
  searchVideos,
  searchUsers,
  searchHashtags,
  getSuggestions,
  getDiscoverData,
  syncVideoToFTS,
  syncUserToFTS,
};
