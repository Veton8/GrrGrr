const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { sqlite } = require('../config/database');
const {
  sanitizeQuery, checkRateLimit, searchVideos, searchUsers,
  searchHashtags, getSuggestions, getDiscoverData,
} = require('../services/searchService');

/**
 * GET /api/search?q=query&type=all|videos|users|hashtags&page=1&limit=10
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { q, type = 'all', page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json({ videos: [], users: [], hashtags: [] });
    }

    // Rate limit (use userId or IP)
    const rateLimitKey = req.user?.id || req.ip;
    if (!checkRateLimit(rateLimitKey)) {
      return res.status(429).json({ error: 'Too many searches. Please wait a moment.' });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const resolveUrl = (url) => (url && url.startsWith('/uploads') ? baseUrl + url : url);
    const currentUserId = req.user?.id;

    const result = {};

    // Search videos
    if (type === 'all' || type === 'videos') {
      const videoIds = searchVideos(q, parseInt(limit), offset);
      if (videoIds.length > 0) {
        const placeholders = videoIds.map(() => '?').join(',');
        const rows = sqlite.prepare(
          `SELECT v.id, v.video_url, v.thumbnail_url, v.hls_url, v.caption, v.duration,
                  v.view_count, v.like_count, v.comment_count, v.share_count, v.created_at,
                  u.id as user_id, u.username, u.display_name, u.avatar_url, u.is_verified
           FROM videos v JOIN users u ON v.user_id = u.id
           WHERE v.id IN (${placeholders})`
        ).all(...videoIds);

        const rowMap = new Map(rows.map(r => [r.id, r]));
        result.videos = videoIds.map(id => rowMap.get(id)).filter(Boolean).map(v => ({
          id: v.id,
          videoUrl: resolveUrl(v.hls_url || v.video_url),
          thumbnailUrl: resolveUrl(v.thumbnail_url),
          caption: v.caption,
          duration: v.duration,
          viewCount: v.view_count,
          likeCount: v.like_count,
          commentCount: v.comment_count,
          createdAt: v.created_at,
          user: {
            id: v.user_id, username: v.username,
            displayName: v.display_name, avatarUrl: resolveUrl(v.avatar_url),
            isVerified: !!v.is_verified,
          },
        }));
      } else {
        result.videos = [];
      }
    }

    // Search users
    if (type === 'all' || type === 'users') {
      const userIds = searchUsers(q, type === 'all' ? 5 : parseInt(limit), type === 'all' ? 0 : offset);
      if (userIds.length > 0) {
        const placeholders = userIds.map(() => '?').join(',');
        const rows = sqlite.prepare(
          `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.is_verified,
                  (SELECT COUNT(*) FROM followers WHERE following_id = u.id) as follower_count
           FROM users u WHERE u.id IN (${placeholders})`
        ).all(...userIds);

        const rowMap = new Map(rows.map(r => [r.id, r]));

        // Check if current user follows these users
        let followedSet = new Set();
        if (currentUserId) {
          for (const uid of userIds) {
            const f = sqlite.prepare('SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?').get(currentUserId, uid);
            if (f) followedSet.add(uid);
          }
        }

        result.users = userIds.map(id => rowMap.get(id)).filter(Boolean).map(u => ({
          id: u.id, username: u.username,
          displayName: u.display_name, avatarUrl: resolveUrl(u.avatar_url),
          bio: u.bio, isVerified: !!u.is_verified,
          followerCount: u.follower_count,
          isFollowing: followedSet.has(u.id),
        }));
      } else {
        result.users = [];
      }
    }

    // Search hashtags
    if (type === 'all' || type === 'hashtags') {
      result.hashtags = searchHashtags(q, type === 'all' ? 5 : parseInt(limit));
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/search/suggestions?q=partial
 */
router.get('/suggestions', optionalAuth, (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }
    const suggestions = getSuggestions(q);
    res.json(suggestions);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/search/discover
 */
router.get('/discover', optionalAuth, (req, res, next) => {
  try {
    const data = getDiscoverData();
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const resolveUrl = (url) => (url && url.startsWith('/uploads') ? baseUrl + url : url);

    // Resolve URLs in rising videos
    data.risingVideos = data.risingVideos.map(v => ({
      id: v.id,
      videoUrl: resolveUrl(v.hls_url || v.video_url),
      thumbnailUrl: resolveUrl(v.thumbnail_url),
      caption: v.caption,
      duration: v.duration,
      viewCount: v.view_count,
      likeCount: v.like_count,
      commentCount: v.comment_count,
      createdAt: v.created_at,
      user: {
        id: v.user_id, username: v.username,
        displayName: v.display_name, avatarUrl: resolveUrl(v.avatar_url),
        isVerified: !!v.is_verified,
      },
    }));

    // Resolve avatar URLs in popular creators
    data.popularCreators = data.popularCreators.map(u => ({
      ...u,
      avatarUrl: resolveUrl(u.avatarUrl),
      isVerified: !!u.isVerified,
    }));

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
