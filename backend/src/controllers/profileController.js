const { sqlite } = require('../config/database');
const { queueNotification } = require('../services/notificationAggregator');
const { syncUserToFTS } = require('../services/searchService');

function resolveUrl(req, url) {
  if (url && url.startsWith('/uploads')) {
    return `${req.protocol}://${req.get('host')}${url}`;
  }
  return url;
}

async function getProfile(req, res, next) {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.id;

    const user = sqlite
      .prepare(
        `SELECT id, username, display_name, avatar_url, bio, is_verified, is_live,
                (SELECT COUNT(*) FROM followers WHERE following_id = users.id) as follower_count,
                (SELECT COUNT(*) FROM followers WHERE follower_id = users.id) as following_count,
                (SELECT COUNT(*) FROM videos WHERE user_id = users.id) as video_count
         FROM users WHERE username = ?`
      )
      .get(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let isFollowing = false;
    if (currentUserId) {
      const follow = sqlite
        .prepare('SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?')
        .get(currentUserId, user.id);
      isFollowing = !!follow;
    }

    res.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: resolveUrl(req, user.avatar_url),
      bio: user.bio,
      isVerified: !!user.is_verified,
      isLive: !!user.is_live,
      followerCount: user.follower_count,
      followingCount: user.following_count,
      videoCount: user.video_count,
      isFollowing,
    });
  } catch (err) {
    next(err);
  }
}

async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    sqlite
      .prepare('UPDATE users SET avatar_url = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(avatarPath, req.user.id);

    const user = sqlite
      .prepare('SELECT id, username, display_name, avatar_url, bio FROM users WHERE id = ?')
      .get(req.user.id);

    res.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: resolveUrl(req, user.avatar_url),
      bio: user.bio,
    });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { displayName, bio, avatarUrl } = req.body;
    sqlite
      .prepare(
        `UPDATE users SET
           display_name = COALESCE(?, display_name),
           bio = COALESCE(?, bio),
           avatar_url = COALESCE(?, avatar_url),
           updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(displayName || null, bio || null, avatarUrl || null, req.user.id);

    // Sync updated profile to FTS search index
    syncUserToFTS(req.user.id);

    const user = sqlite
      .prepare('SELECT id, username, display_name, avatar_url, bio FROM users WHERE id = ?')
      .get(req.user.id);
    res.json({
      ...user,
      displayName: user.display_name,
      avatarUrl: resolveUrl(req, user.avatar_url),
    });
  } catch (err) {
    next(err);
  }
}

async function followUser(req, res, next) {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }
    const info = sqlite
      .prepare('INSERT OR IGNORE INTO followers (follower_id, following_id) VALUES (?, ?)')
      .run(req.user.id, userId);

    // Notify the user being followed
    if (info.changes > 0) {
      queueNotification(userId, {
        type: 'new_follower',
        title: 'New follower',
        body: `${req.user.username} started following you`,
        data: { followerId: req.user.id, followerUsername: req.user.username },
      });
    }

    res.json({ message: 'Followed successfully' });
  } catch (err) {
    next(err);
  }
}

async function unfollowUser(req, res, next) {
  try {
    const { userId } = req.params;
    sqlite
      .prepare('DELETE FROM followers WHERE follower_id = ? AND following_id = ?')
      .run(req.user.id, userId);
    res.json({ message: 'Unfollowed successfully' });
  } catch (err) {
    next(err);
  }
}

async function getUserVideos(req, res, next) {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const rows = sqlite
      .prepare(
        `SELECT v.id, v.video_url, v.thumbnail_url, v.hls_url, v.view_count, v.like_count, v.duration,
                v.caption, v.width, v.height, v.processing_status, v.created_at,
                u.id as user_id, u.username, u.display_name, u.avatar_url, u.is_verified
         FROM videos v JOIN users u ON v.user_id = u.id
         WHERE u.username = ?
         ORDER BY v.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(username, parseInt(limit), parseInt(offset));

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const resolve = (url) => (url && url.startsWith('/uploads') ? baseUrl + url : url);

    const videos = rows.map((v) => ({
      id: v.id,
      videoUrl: resolve(v.hls_url || v.video_url),
      rawVideoUrl: resolve(v.video_url),
      thumbnailUrl: resolve(v.thumbnail_url),
      viewCount: v.view_count,
      likeCount: v.like_count,
      duration: v.duration,
      caption: v.caption,
      processingStatus: v.processing_status,
      createdAt: v.created_at,
      user: {
        id: v.user_id,
        username: v.username,
        displayName: v.display_name,
        avatarUrl: resolve(v.avatar_url),
        isVerified: !!v.is_verified,
      },
    }));

    res.json(videos);
  } catch (err) {
    next(err);
  }
}

async function getFollowers(req, res, next) {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    const currentUserId = req.user?.id;

    const rows = sqlite
      .prepare(
        `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified
         FROM followers f
         JOIN users u ON f.follower_id = u.id
         WHERE f.following_id = ?
         ORDER BY f.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(userId, parseInt(limit), parseInt(offset));

    const users = rows.map((u) => {
      let isFollowing = false;
      if (currentUserId && currentUserId !== u.id) {
        const f = sqlite
          .prepare('SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?')
          .get(currentUserId, u.id);
        isFollowing = !!f;
      }
      return {
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatarUrl: resolveUrl(req, u.avatar_url),
        isVerified: !!u.is_verified,
        isFollowing,
        isMe: u.id === currentUserId,
      };
    });

    res.json({ users, page: parseInt(page), hasMore: rows.length === parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

async function getFollowing(req, res, next) {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    const currentUserId = req.user?.id;

    const rows = sqlite
      .prepare(
        `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified
         FROM followers f
         JOIN users u ON f.following_id = u.id
         WHERE f.follower_id = ?
         ORDER BY f.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(userId, parseInt(limit), parseInt(offset));

    const users = rows.map((u) => {
      let isFollowing = false;
      if (currentUserId && currentUserId !== u.id) {
        const f = sqlite
          .prepare('SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?')
          .get(currentUserId, u.id);
        isFollowing = !!f;
      }
      return {
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatarUrl: resolveUrl(req, u.avatar_url),
        isVerified: !!u.is_verified,
        isFollowing,
        isMe: u.id === currentUserId,
      };
    });

    res.json({ users, page: parseInt(page), hasMore: rows.length === parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, uploadAvatar, updateProfile, followUser, unfollowUser, getUserVideos, getFollowers, getFollowing };
