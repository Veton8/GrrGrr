const { sqlite } = require('../config/database');
const { redisClient } = require('../config/redis');
const { v4: uuidv4 } = require('uuid');

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
    res.status(201).json(stream);
  } catch (err) {
    next(err);
  }
}

async function endLive(req, res, next) {
  try {
    const { streamId } = req.params;
    sqlite
      .prepare("UPDATE livestreams SET is_active = 0, ended_at = datetime('now') WHERE id = ? AND host_id = ?")
      .run(streamId, req.user.id);
    sqlite.prepare('UPDATE users SET is_live = 0 WHERE id = ?').run(req.user.id);
    await redisClient.del(`live:${streamId}:viewers`);
    res.json({ message: 'Stream ended' });
  } catch (err) {
    next(err);
  }
}

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

    const streams = rows.map((s) => ({
      id: s.id,
      title: s.title,
      thumbnailUrl: s.thumbnail_url,
      viewerCount: s.viewer_count,
      startedAt: s.started_at,
      host: {
        id: s.user_id,
        username: s.username,
        displayName: s.display_name,
        avatarUrl: s.avatar_url,
        isVerified: !!s.is_verified,
      },
    }));
    res.json(streams);
  } catch (err) {
    next(err);
  }
}

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

module.exports = { goLive, endLive, getLiveStreams, getLiveStream };
