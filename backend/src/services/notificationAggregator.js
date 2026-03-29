const { sendPushNotification } = require('./pushService');

// In-memory aggregation buffer: Map<userId, { likes: Map<videoId, {users: [], videoTitle: string, timer: NodeJS.Timeout}> }>
const buffer = new Map();

const AGGREGATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Notification types that skip aggregation and send immediately
const IMMEDIATE_TYPES = new Set([
  'live_started',
  'direct_message',
  'gift_received',
  'new_follower',
  'comment',
  'battle_invite',
  'strike_issued',
]);

/**
 * Queue a notification, aggregating likes over 5-minute windows.
 * Immediate types bypass aggregation entirely.
 */
function queueNotification(userId, { type, title, body, data = {} }) {
  if (IMMEDIATE_TYPES.has(type)) {
    sendPushNotification(userId, { title, body, data, type });
    return;
  }

  // Aggregate likes per video
  if (type === 'like') {
    aggregateLike(userId, data);
    return;
  }

  // Default: send immediately for unknown types
  sendPushNotification(userId, { title, body, data, type });
}

/**
 * Aggregate like notifications per video within a 5-minute window.
 */
function aggregateLike(userId, data) {
  const { videoId, videoTitle = 'your video', likerUsername } = data;
  if (!videoId || !likerUsername) {
    // Missing data, send immediately
    sendPushNotification(userId, {
      title: 'New like',
      body: `${likerUsername || 'Someone'} liked your video`,
      data,
      type: 'like',
    });
    return;
  }

  if (!buffer.has(userId)) {
    buffer.set(userId, new Map());
  }
  const userBuffer = buffer.get(userId);

  if (!userBuffer.has(videoId)) {
    // First like for this video in this window — start timer
    const entry = {
      users: [likerUsername],
      videoTitle,
      videoId,
      timer: setTimeout(() => flushLikes(userId, videoId), AGGREGATION_WINDOW_MS),
    };
    userBuffer.set(videoId, entry);
  } else {
    const entry = userBuffer.get(videoId);
    if (!entry.users.includes(likerUsername)) {
      entry.users.push(likerUsername);
    }
  }
}

/**
 * Flush aggregated likes for a specific user+video and send the notification.
 */
function flushLikes(userId, videoId) {
  const userBuffer = buffer.get(userId);
  if (!userBuffer) return;

  const entry = userBuffer.get(videoId);
  if (!entry) return;

  clearTimeout(entry.timer);
  userBuffer.delete(videoId);
  if (userBuffer.size === 0) buffer.delete(userId);

  const { users, videoTitle } = entry;
  let body;
  if (users.length === 1) {
    body = `${users[0]} liked your video "${videoTitle}"`;
  } else if (users.length === 2) {
    body = `${users[0]} and ${users[1]} liked your video "${videoTitle}"`;
  } else {
    body = `${users[0]} and ${users.length - 1} others liked your video "${videoTitle}"`;
  }

  sendPushNotification(userId, {
    title: 'New likes',
    body,
    data: { videoId, likeCount: users.length },
    type: 'like',
  });
}

/**
 * Flush all pending aggregated notifications (e.g., on server shutdown).
 */
function flushAll() {
  for (const [userId, userBuffer] of buffer.entries()) {
    for (const videoId of userBuffer.keys()) {
      flushLikes(userId, videoId);
    }
  }
}

module.exports = { queueNotification, flushAll };
