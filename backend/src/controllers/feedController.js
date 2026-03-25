const { sqlite } = require('../config/database');

async function getFeed(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const currentUserId = req.user?.id;

    const rows = sqlite
      .prepare(
        `SELECT v.id, v.video_url, v.thumbnail_url, v.caption, v.duration,
                v.view_count, v.like_count, v.comment_count, v.share_count, v.created_at,
                u.id as user_id, u.username, u.display_name, u.avatar_url, u.is_verified
         FROM videos v
         JOIN users u ON v.user_id = u.id
         ORDER BY v.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(parseInt(limit), parseInt(offset));

    let likedVideoIds = new Set();
    let followedUserIds = new Set();

    if (currentUserId && rows.length > 0) {
      const videoIds = rows.map((v) => v.id);
      for (const vid of videoIds) {
        const liked = sqlite
          .prepare('SELECT 1 FROM video_likes WHERE user_id = ? AND video_id = ?')
          .get(currentUserId, vid);
        if (liked) likedVideoIds.add(vid);
      }

      const userIds = [...new Set(rows.map((v) => v.user_id))];
      for (const uid of userIds) {
        const followed = sqlite
          .prepare('SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?')
          .get(currentUserId, uid);
        if (followed) followedUserIds.add(uid);
      }
    }

    const videos = rows.map((v) => ({
      id: v.id,
      videoUrl: v.video_url,
      thumbnailUrl: v.thumbnail_url,
      caption: v.caption,
      duration: v.duration,
      viewCount: v.view_count,
      likeCount: v.like_count,
      commentCount: v.comment_count,
      shareCount: v.share_count,
      createdAt: v.created_at,
      isLiked: likedVideoIds.has(v.id),
      user: {
        id: v.user_id,
        username: v.username,
        displayName: v.display_name,
        avatarUrl: v.avatar_url,
        isVerified: !!v.is_verified,
        isFollowing: followedUserIds.has(v.user_id),
      },
    }));

    res.json({ videos, page: parseInt(page), hasMore: rows.length === parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

async function likeVideo(req, res, next) {
  try {
    const { videoId } = req.params;
    sqlite
      .prepare('INSERT OR IGNORE INTO video_likes (user_id, video_id) VALUES (?, ?)')
      .run(req.user.id, videoId);
    sqlite.prepare('UPDATE videos SET like_count = like_count + 1 WHERE id = ?').run(videoId);
    res.json({ message: 'Liked' });
  } catch (err) {
    next(err);
  }
}

async function unlikeVideo(req, res, next) {
  try {
    const { videoId } = req.params;
    const info = sqlite
      .prepare('DELETE FROM video_likes WHERE user_id = ? AND video_id = ?')
      .run(req.user.id, videoId);
    if (info.changes > 0) {
      sqlite
        .prepare('UPDATE videos SET like_count = MAX(like_count - 1, 0) WHERE id = ?')
        .run(videoId);
    }
    res.json({ message: 'Unliked' });
  } catch (err) {
    next(err);
  }
}

async function getComments(req, res, next) {
  try {
    const { videoId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const rows = sqlite
      .prepare(
        `SELECT c.id, c.content, c.created_at,
                u.id as user_id, u.username, u.display_name, u.avatar_url
         FROM comments c JOIN users u ON c.user_id = u.id
         WHERE c.video_id = ?
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(videoId, parseInt(limit), parseInt(offset));
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function addComment(req, res, next) {
  try {
    const { videoId } = req.params;
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    sqlite
      .prepare('INSERT INTO comments (id, video_id, user_id, content) VALUES (?, ?, ?, ?)')
      .run(id, videoId, req.user.id, content.trim());
    sqlite.prepare('UPDATE videos SET comment_count = comment_count + 1 WHERE id = ?').run(videoId);

    const comment = sqlite
      .prepare('SELECT id, content, created_at FROM comments WHERE id = ?')
      .get(id);
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
}

module.exports = { getFeed, likeVideo, unlikeVideo, getComments, addComment };
