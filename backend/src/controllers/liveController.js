const { sqlite } = require('../config/database');
const { redisClient } = require('../config/redis');
const { v4: uuidv4 } = require('uuid');
const { sendBulkNotifications } = require('../services/pushService');
const { generateToken, closeRoom, isConfigured, LIVEKIT_URL } = require('../services/livekitService');

/**
 * POST /api/live/start — Start a new livestream.
 * Creates DB record, generates a LiveKit publisher token, and notifies followers.
 * Returns { stream, token, livekitUrl } so the client can connect immediately.
 */
async function goLive(req, res, next) {
  try {
    const { title, thumbnailUrl } = req.body;

    const existing = sqlite
      .prepare('SELECT id FROM livestreams WHERE host_id = ? AND is_active = 1')
      .get(req.user.id);
    if (existing) {
      return res.status(400).json({ error: 'Already streaming' });
    }

    const id = uuidv4();
    sqlite
      .prepare('INSERT INTO livestreams (id, host_id, title, thumbnail_url) VALUES (?, ?, ?, ?)')
      .run(id, req.user.id, title || '', thumbnailUrl || null);

    sqlite.prepare('UPDATE users SET is_live = 1 WHERE id = ?').run(req.user.id);
    await redisClient.set(`live:${id}:viewers`, '0');

    const stream = sqlite
      .prepare('SELECT id, title, thumbnail_url, started_at FROM livestreams WHERE id = ?')
      .get(id);

    // Generate LiveKit publisher token (streamer can publish + subscribe)
    let token = null;
    let livekitUrl = null;
    if (isConfigured()) {
      const user = sqlite.prepare('SELECT avatar_url FROM users WHERE id = ?').get(req.user.id);
      token = await generateToken(req.user.id, req.user.username, id, true, user?.avatar_url);
      livekitUrl = LIVEKIT_URL;
    }

    // Notify all followers that this user went live
    const followerRows = sqlite
      .prepare('SELECT follower_id FROM followers WHERE following_id = ?')
      .all(req.user.id);
    const followerIds = followerRows.map((r) => r.follower_id);
    if (followerIds.length > 0) {
      sendBulkNotifications(followerIds, {
        title: `${req.user.username} is live!`,
        body: title || 'Started a livestream',
        data: { streamId: id, hostId: req.user.id, hostUsername: req.user.username },
        type: 'live_started',
      });
    }

    res.status(201).json({ stream, token, livekitUrl });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/live/:streamId/join — Join a livestream as a viewer.
 * Generates a LiveKit subscriber token (can subscribe only, cannot publish).
 * Returns { token, livekitUrl, stream }.
 */
async function joinLive(req, res, next) {
  try {
    const { streamId } = req.params;

    const stream = sqlite
      .prepare(
        `SELECT l.*, u.username as host_username, u.display_name as host_display_name,
                u.avatar_url as host_avatar_url, u.is_verified as host_is_verified
         FROM livestreams l JOIN users u ON l.host_id = u.id
         WHERE l.id = ? AND l.is_active = 1`
      )
      .get(streamId);

    if (!stream) {
      return res.status(404).json({ error: 'Stream not found or has ended' });
    }

    let token = null;
    let livekitUrl = null;
    if (isConfigured()) {
      const user = sqlite.prepare('SELECT avatar_url FROM users WHERE id = ?').get(req.user.id);
      token = await generateToken(req.user.id, req.user.username, streamId, false, user?.avatar_url);
      livekitUrl = LIVEKIT_URL;
    }

    res.json({
      token,
      livekitUrl,
      stream: {
        id: stream.id,
        title: stream.title,
        viewerCount: stream.viewer_count,
        startedAt: stream.started_at,
        totalGiftsValue: stream.total_gifts_value,
        host: {
          id: stream.host_id,
          username: stream.host_username,
          displayName: stream.host_display_name,
          avatarUrl: stream.host_avatar_url,
          isVerified: !!stream.host_is_verified,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/live/:streamId/end — End an active livestream.
 * Marks stream as ended, cleans up Redis, and closes the LiveKit room.
 */
async function endLive(req, res, next) {
  try {
    const { streamId } = req.params;
    sqlite
      .prepare("UPDATE livestreams SET is_active = 0, ended_at = datetime('now') WHERE id = ? AND host_id = ?")
      .run(streamId, req.user.id);
    sqlite.prepare('UPDATE users SET is_live = 0 WHERE id = ?').run(req.user.id);
    await redisClient.del(`live:${streamId}:viewers`);

    // Close the LiveKit room (disconnects all participants)
    if (isConfigured()) {
      closeRoom(streamId).catch(() => {}); // fire and forget
    }

    res.json({ message: 'Stream ended' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/live/ — Get all currently active livestreams.
 */
async function getLiveStreams(req, res, next) {
  try {
    const rows = sqlite
      .prepare(
        `SELECT l.id, l.title, l.thumbnail_url, l.viewer_count, l.started_at,
                u.id as user_id, u.username, u.display_name, u.avatar_url, u.is_verified
         FROM livestreams l JOIN users u ON l.host_id = u.id
         WHERE l.is_active = 1
         ORDER BY l.viewer_count DESC`
      )
      .all();

    const baseUrl = req ? `${req.protocol}://${req.get('host')}` : '';
    const resolveUrl = (url) => (url && url.startsWith('/uploads') ? baseUrl + url : url);

    const streams = rows.map((s) => ({
      id: s.id,
      title: s.title,
      thumbnailUrl: resolveUrl(s.thumbnail_url),
      viewerCount: s.viewer_count,
      startedAt: s.started_at,
      host: {
        id: s.user_id,
        username: s.username,
        displayName: s.display_name,
        avatarUrl: resolveUrl(s.avatar_url),
        isVerified: !!s.is_verified,
      },
    }));
    res.json(streams);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/live/:streamId — Get single livestream details.
 */
async function getLiveStream(req, res, next) {
  try {
    const { streamId } = req.params;
    const s = sqlite
      .prepare(
        `SELECT l.*, u.username, u.display_name, u.avatar_url, u.is_verified
         FROM livestreams l JOIN users u ON l.host_id = u.id
         WHERE l.id = ?`
      )
      .get(streamId);

    if (!s) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    const viewerCount = await redisClient.get(`live:${streamId}:viewers`);

    res.json({
      id: s.id,
      title: s.title,
      isActive: !!s.is_active,
      viewerCount: parseInt(viewerCount || s.viewer_count),
      totalGiftsValue: s.total_gifts_value,
      startedAt: s.started_at,
      host: {
        id: s.host_id,
        username: s.username,
        displayName: s.display_name,
        avatarUrl: s.avatar_url,
        isVerified: !!s.is_verified,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { goLive, joinLive, endLive, getLiveStreams, getLiveStream };
