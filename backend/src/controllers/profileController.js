const { sqlite } = require('../config/database');

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
      avatarUrl: user.avatar_url,
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

    const user = sqlite
      .prepare('SELECT id, username, display_name, avatar_url, bio FROM users WHERE id = ?')
      .get(req.user.id);
    res.json(user);
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
    sqlite
      .prepare('INSERT OR IGNORE INTO followers (follower_id, following_id) VALUES (?, ?)')
      .run(req.user.id, userId);
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
        `SELECT v.id, v.thumbnail_url, v.view_count, v.like_count, v.duration
         FROM videos v JOIN users u ON v.user_id = u.id
         WHERE u.username = ?
         ORDER BY v.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(username, parseInt(limit), parseInt(offset));
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile, followUser, unfollowUser, getUserVideos };
