const { sqlite } = require('../config/database');
const { enqueueVideo } = require('../queues/videoQueue');
const { getPresignedUploadUrl, STORAGE_TYPE } = require('../services/storageService');
const { queueNotification } = require('../services/notificationAggregator');
const { linkVideoHashtags, recordView } = require('../services/engagementTracker');
const { syncVideoToFTS } = require('../services/searchService');
const { getForYouCandidates, getTrendingHashtags: getTrendingHashtagsFn, getVideosByHashtag: getVideosByHashtagFn } = require('../services/recommendationEngine');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

async function getFeed(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const currentUserId = req.user?.id;

    const rows = sqlite
      .prepare(
        `SELECT v.id, v.video_url, v.thumbnail_url, v.hls_url, v.caption, v.duration,
                v.width, v.height, v.processing_status,
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

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const resolveUrl = (url) => (url && url.startsWith('/uploads') ? baseUrl + url : url);

    const videos = rows.map((v) => ({
      id: v.id,
      videoUrl: resolveUrl(v.hls_url || v.video_url),
      rawVideoUrl: resolveUrl(v.video_url),
      hlsUrl: resolveUrl(v.hls_url),
      thumbnailUrl: resolveUrl(v.thumbnail_url),
      caption: v.caption,
      duration: v.duration,
      width: v.width,
      height: v.height,
      processingStatus: v.processing_status,
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
        avatarUrl: resolveUrl(v.avatar_url),
        isVerified: !!v.is_verified,
        isFollowing: followedUserIds.has(v.user_id),
      },
    }));

    res.json({ videos, page: parseInt(page), hasMore: rows.length === parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

async function uploadVideo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }
    const { caption = '' } = req.body;
    const id = uuidv4();
    const videoUrl = `/uploads/videos/${req.file.filename}`;
    const inputPath = req.file.path;

    sqlite
      .prepare(
        `INSERT INTO videos (id, user_id, video_url, caption, duration, view_count, like_count, comment_count, share_count, processing_status)
         VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 'queued')`
      )
      .run(id, req.user.id, videoUrl, caption.trim());

    // Link hashtags from caption
    linkVideoHashtags(id, caption.trim());

    // Sync to FTS search index
    syncVideoToFTS(id);

    // Enqueue background processing (transcode, thumbnail, HLS)
    try {
      await enqueueVideo(id, inputPath);
    } catch (queueErr) {
      // If Redis/queue is unavailable, mark as pending — video still works raw
      console.warn('[Upload] Queue unavailable, skipping processing:', queueErr.message);
      sqlite.prepare("UPDATE videos SET processing_status = 'pending' WHERE id = ?").run(id);
    }

    const video = sqlite.prepare('SELECT * FROM videos WHERE id = ?').get(id);
    const user = sqlite.prepare('SELECT id, username, display_name, avatar_url, is_verified FROM users WHERE id = ?').get(req.user.id);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const resolve = (url) => (url && url.startsWith('/uploads') ? baseUrl + url : url);
    res.status(201).json({
      id: video.id,
      videoUrl: resolve(video.video_url),
      rawVideoUrl: resolve(video.raw_video_url),
      thumbnailUrl: resolve(video.thumbnail_url),
      processingStatus: video.processing_status,
      caption: video.caption,
      duration: video.duration,
      viewCount: video.view_count || 0,
      likeCount: video.like_count || 0,
      commentCount: video.comment_count || 0,
      shareCount: video.share_count || 0,
      createdAt: video.created_at,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: resolve(user.avatar_url),
        isVerified: !!user.is_verified,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/feed/upload-url — presigned URL for direct-to-storage upload. */
async function getUploadUrl(req, res, next) {
  try {
    const { filename, contentType = 'video/mp4' } = req.body;
    const id = uuidv4();
    const ext = path.extname(filename || '.mp4') || '.mp4';
    const key = `videos/raw/${id}${ext}`;
    const url = await getPresignedUploadUrl(key, contentType);
    res.json({ uploadUrl: url, videoId: id, storageKey: key });
  } catch (err) {
    next(err);
  }
}

/** POST /api/feed/:videoId/process — enqueue processing for an already-uploaded video. */
async function processVideoEndpoint(req, res, next) {
  try {
    const { videoId } = req.params;
    const video = sqlite.prepare('SELECT * FROM videos WHERE id = ?').get(videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    if (video.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const inputPath = video.video_url.startsWith('/uploads')
      ? path.join(__dirname, '..', '..', video.video_url)
      : video.video_url;

    await enqueueVideo(videoId, inputPath);
    res.json({ videoId, status: 'queued' });
  } catch (err) {
    next(err);
  }
}

/** GET /api/feed/:videoId/status — processing status + progress. */
async function getVideoStatus(req, res, next) {
  try {
    const { videoId } = req.params;
    const video = sqlite
      .prepare('SELECT id, processing_status, hls_url, thumbnail_url, duration, width, height, processed_at FROM videos WHERE id = ?')
      .get(videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const resolveUrl = (url) => (url && url.startsWith('/uploads') ? baseUrl + url : url);

    res.json({
      videoId: video.id,
      processingStatus: video.processing_status,
      hlsUrl: resolveUrl(video.hls_url),
      thumbnailUrl: resolveUrl(video.thumbnail_url),
      duration: video.duration,
      width: video.width,
      height: video.height,
      processedAt: video.processed_at,
    });
  } catch (err) {
    next(err);
  }
}

async function likeVideo(req, res, next) {
  try {
    const { videoId } = req.params;
    const info = sqlite
      .prepare('INSERT OR IGNORE INTO video_likes (user_id, video_id) VALUES (?, ?)')
      .run(req.user.id, videoId);
    sqlite.prepare('UPDATE videos SET like_count = like_count + 1 WHERE id = ?').run(videoId);

    // Notify video owner (aggregated — batched over 5-minute windows)
    if (info.changes > 0) {
      const video = sqlite.prepare('SELECT user_id, caption FROM videos WHERE id = ?').get(videoId);
      if (video && video.user_id !== req.user.id) {
        queueNotification(video.user_id, {
          type: 'like',
          title: 'New like',
          body: `${req.user.username} liked your video`,
          data: { videoId, videoTitle: video.caption?.slice(0, 40) || 'your video', likerUsername: req.user.username },
        });
      }
    }

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

    // Notify video owner
    const video = sqlite.prepare('SELECT user_id, caption FROM videos WHERE id = ?').get(videoId);
    if (video && video.user_id !== req.user.id) {
      queueNotification(video.user_id, {
        type: 'comment',
        title: 'New comment',
        body: `${req.user.username} commented: "${content.trim().slice(0, 60)}"`,
        data: { videoId, commentId: id },
      });
    }

    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
}

async function recordVideoView(req, res, next) {
  try {
    const { videoId } = req.params;
    const { watchDurationMs, source = 'fyp' } = req.body;

    if (!watchDurationMs || watchDurationMs < 1000) {
      return res.json({ recorded: false, reason: 'duration_too_short' });
    }

    const validSources = ['fyp', 'following', 'profile', 'search', 'share'];
    const safeSource = validSources.includes(source) ? source : 'fyp';

    const result = recordView(req.user.id, videoId, watchDurationMs, safeSource);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getForYouFeed(req, res, next) {
  try {
    const { page = 1, limit = 10, exclude = '' } = req.query;
    const currentUserId = req.user?.id;

    const excludeIds = exclude ? exclude.split(',').filter(Boolean) : [];

    let videoIds;
    if (currentUserId) {
      videoIds = getForYouCandidates(currentUserId, parseInt(limit), excludeIds);
    } else {
      // Not logged in: just return trending
      const rows = sqlite.prepare(
        `SELECT v.id FROM videos v
         LEFT JOIN video_scores vs ON v.id = vs.video_id
         ORDER BY COALESCE(vs.score, 0) DESC, v.created_at DESC
         LIMIT ? OFFSET ?`
      ).all(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
      videoIds = rows.map(r => r.id);
    }

    if (videoIds.length === 0) {
      return res.json({ videos: [], page: parseInt(page), hasMore: false });
    }

    // Fetch full video data
    const placeholders = videoIds.map(() => '?').join(',');
    const rows = sqlite.prepare(
      `SELECT v.id, v.video_url, v.thumbnail_url, v.hls_url, v.caption, v.duration,
              v.width, v.height, v.processing_status,
              v.view_count, v.like_count, v.comment_count, v.share_count, v.created_at,
              u.id as user_id, u.username, u.display_name, u.avatar_url, u.is_verified
       FROM videos v
       JOIN users u ON v.user_id = u.id
       WHERE v.id IN (${placeholders})`
    ).all(...videoIds);

    // Maintain the order from videoIds
    const rowMap = new Map(rows.map(r => [r.id, r]));
    const orderedRows = videoIds.map(id => rowMap.get(id)).filter(Boolean);

    // Get liked/followed status
    let likedVideoIds = new Set();
    let followedUserIds = new Set();
    if (currentUserId && orderedRows.length > 0) {
      for (const v of orderedRows) {
        const liked = sqlite.prepare('SELECT 1 FROM video_likes WHERE user_id = ? AND video_id = ?').get(currentUserId, v.id);
        if (liked) likedVideoIds.add(v.id);
      }
      const userIds = [...new Set(orderedRows.map(v => v.user_id))];
      for (const uid of userIds) {
        const followed = sqlite.prepare('SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?').get(currentUserId, uid);
        if (followed) followedUserIds.add(uid);
      }
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const resolveUrl = (url) => (url && url.startsWith('/uploads') ? baseUrl + url : url);

    const videos = orderedRows.map(v => ({
      id: v.id,
      videoUrl: resolveUrl(v.hls_url || v.video_url),
      rawVideoUrl: resolveUrl(v.video_url),
      hlsUrl: resolveUrl(v.hls_url),
      thumbnailUrl: resolveUrl(v.thumbnail_url),
      caption: v.caption,
      duration: v.duration,
      width: v.width,
      height: v.height,
      processingStatus: v.processing_status,
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
        avatarUrl: resolveUrl(v.avatar_url),
        isVerified: !!v.is_verified,
        isFollowing: followedUserIds.has(v.user_id),
      },
    }));

    res.json({ videos, page: parseInt(page), hasMore: videos.length === parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

async function getFollowingFeed(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const currentUserId = req.user.id;

    // Get followed user IDs
    const following = sqlite.prepare(
      'SELECT following_id FROM followers WHERE follower_id = ?'
    ).all(currentUserId);
    const followedIds = following.map(f => f.following_id);

    if (followedIds.length === 0) {
      return res.json({ videos: [], page: parseInt(page), hasMore: false });
    }

    const fPlaceholders = followedIds.map(() => '?').join(',');

    // Get watched video IDs for de-prioritization
    const watchedRows = sqlite.prepare('SELECT DISTINCT video_id FROM video_views WHERE user_id = ?').all(currentUserId);
    const watchedSet = new Set(watchedRows.map(r => r.video_id));

    const rows = sqlite.prepare(
      `SELECT v.id, v.video_url, v.thumbnail_url, v.hls_url, v.caption, v.duration,
              v.width, v.height, v.processing_status,
              v.view_count, v.like_count, v.comment_count, v.share_count, v.created_at,
              u.id as user_id, u.username, u.display_name, u.avatar_url, u.is_verified
       FROM videos v
       JOIN users u ON v.user_id = u.id
       WHERE v.user_id IN (${fPlaceholders})
       ORDER BY v.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...followedIds, parseInt(limit) + 10, offset); // fetch extra for re-ordering

    // De-prioritize watched videos (push to end, don't remove)
    const unwatched = rows.filter(v => !watchedSet.has(v.id));
    const watched = rows.filter(v => watchedSet.has(v.id));
    const reordered = [...unwatched, ...watched].slice(0, parseInt(limit));

    let likedVideoIds = new Set();
    if (currentUserId && reordered.length > 0) {
      for (const v of reordered) {
        const liked = sqlite.prepare('SELECT 1 FROM video_likes WHERE user_id = ? AND video_id = ?').get(currentUserId, v.id);
        if (liked) likedVideoIds.add(v.id);
      }
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const resolveUrl = (url) => (url && url.startsWith('/uploads') ? baseUrl + url : url);

    const videos = reordered.map(v => ({
      id: v.id,
      videoUrl: resolveUrl(v.hls_url || v.video_url),
      rawVideoUrl: resolveUrl(v.video_url),
      hlsUrl: resolveUrl(v.hls_url),
      thumbnailUrl: resolveUrl(v.thumbnail_url),
      caption: v.caption,
      duration: v.duration,
      width: v.width,
      height: v.height,
      processingStatus: v.processing_status,
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
        avatarUrl: resolveUrl(v.avatar_url),
        isVerified: !!v.is_verified,
        isFollowing: true, // They're all followed since this is the Following feed
      },
    }));

    res.json({ videos, page: parseInt(page), hasMore: reordered.length === parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

async function getTrendingHashtagsEndpoint(req, res, next) {
  try {
    const hashtags = getTrendingHashtagsFn(parseInt(req.query.limit) || 20);
    res.json(hashtags);
  } catch (err) {
    next(err);
  }
}

async function getHashtagVideos(req, res, next) {
  try {
    const { name } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const videoIds = getVideosByHashtagFn(name, parseInt(limit), offset);

    if (videoIds.length === 0) {
      // Get hashtag info even if no videos
      const hashtag = sqlite.prepare('SELECT * FROM hashtags WHERE name = ?').get(name.toLowerCase());
      return res.json({ hashtag: hashtag || null, videos: [], page: parseInt(page), hasMore: false });
    }

    const placeholders = videoIds.map(() => '?').join(',');
    const rows = sqlite.prepare(
      `SELECT v.id, v.video_url, v.thumbnail_url, v.hls_url, v.caption, v.duration,
              v.width, v.height, v.processing_status,
              v.view_count, v.like_count, v.comment_count, v.share_count, v.created_at,
              u.id as user_id, u.username, u.display_name, u.avatar_url, u.is_verified
       FROM videos v JOIN users u ON v.user_id = u.id
       WHERE v.id IN (${placeholders})`
    ).all(...videoIds);

    const rowMap = new Map(rows.map(r => [r.id, r]));
    const orderedRows = videoIds.map(id => rowMap.get(id)).filter(Boolean);

    const currentUserId = req.user?.id;
    let likedVideoIds = new Set();
    let followedUserIds = new Set();
    if (currentUserId) {
      for (const v of orderedRows) {
        const liked = sqlite.prepare('SELECT 1 FROM video_likes WHERE user_id = ? AND video_id = ?').get(currentUserId, v.id);
        if (liked) likedVideoIds.add(v.id);
      }
      const userIds = [...new Set(orderedRows.map(v => v.user_id))];
      for (const uid of userIds) {
        const followed = sqlite.prepare('SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?').get(currentUserId, uid);
        if (followed) followedUserIds.add(uid);
      }
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const resolveUrl = (url) => (url && url.startsWith('/uploads') ? baseUrl + url : url);

    const hashtag = sqlite.prepare('SELECT id, name, video_count as videoCount, trending_score as trendingScore FROM hashtags WHERE name = ?').get(name.toLowerCase());

    const videos = orderedRows.map(v => ({
      id: v.id,
      videoUrl: resolveUrl(v.hls_url || v.video_url),
      rawVideoUrl: resolveUrl(v.video_url),
      hlsUrl: resolveUrl(v.hls_url),
      thumbnailUrl: resolveUrl(v.thumbnail_url),
      caption: v.caption,
      duration: v.duration,
      width: v.width, height: v.height,
      processingStatus: v.processing_status,
      viewCount: v.view_count, likeCount: v.like_count,
      commentCount: v.comment_count, shareCount: v.share_count,
      createdAt: v.created_at,
      isLiked: likedVideoIds.has(v.id),
      user: {
        id: v.user_id, username: v.username, displayName: v.display_name,
        avatarUrl: resolveUrl(v.avatar_url), isVerified: !!v.is_verified,
        isFollowing: followedUserIds.has(v.user_id),
      },
    }));

    res.json({ hashtag, videos, page: parseInt(page), hasMore: videos.length === parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

async function shareVideo(req, res, next) {
  try {
    const { videoId } = req.params;
    const video = sqlite.prepare('SELECT id, user_id, caption FROM videos WHERE id = ?').get(videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    sqlite.prepare('UPDATE videos SET share_count = share_count + 1 WHERE id = ?').run(videoId);

    const updated = sqlite.prepare('SELECT share_count FROM videos WHERE id = ?').get(videoId);
    res.json({ videoId, shareCount: updated.share_count });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getFeed, uploadVideo, likeVideo, unlikeVideo, getComments, addComment,
  getUploadUrl, processVideoEndpoint, getVideoStatus,
  recordVideoView, getForYouFeed, getFollowingFeed,
  getTrendingHashtagsEndpoint, getHashtagVideos, shareVideo,
};
