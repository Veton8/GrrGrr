/**
 * LiveKit Token Generation Service
 *
 * Generates JWT access tokens for LiveKit rooms.
 * Publishers (streamers) get publish+subscribe permissions.
 * Subscribers (viewers) get subscribe-only permissions.
 *
 * @module services/livekitService
 */
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const LIVEKIT_URL = process.env.LIVEKIT_URL || '';

/**
 * Generate a LiveKit access token for a user joining a room.
 *
 * @param {string} userId - The user's database ID
 * @param {string} username - The user's display username
 * @param {string} roomName - The LiveKit room name (typically the livestream ID)
 * @param {boolean} isPublisher - Whether the user can publish tracks (streamer=true, viewer=false)
 * @param {string} [avatarUrl] - Optional avatar URL to include in metadata
 * @returns {Promise<string>} The signed JWT token
 */
async function generateToken(userId, username, roomName, isPublisher, avatarUrl) {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error('LiveKit API key and secret are required. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET env vars.');
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: `user_${userId}`,
    name: username,
    metadata: JSON.stringify({ username, avatarUrl: avatarUrl || null, userId }),
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: isPublisher,
    canSubscribe: true,
    canPublishData: isPublisher,
  });

  // Token valid for 6 hours
  at.ttl = '6h';

  return await at.toJwt();
}

/**
 * Get a RoomServiceClient instance for server-side room management.
 *
 * @returns {RoomServiceClient}
 */
function getRoomServiceClient() {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return null;
  }
  // RoomServiceClient expects HTTP(S) URL, not WS
  const httpUrl = LIVEKIT_URL
    .replace('wss://', 'https://')
    .replace('ws://', 'http://');
  return new RoomServiceClient(httpUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

/**
 * Delete/close a LiveKit room (forces all participants to disconnect).
 *
 * @param {string} roomName - The LiveKit room name to close
 * @returns {Promise<void>}
 */
async function closeRoom(roomName) {
  const client = getRoomServiceClient();
  if (!client) {
    console.warn('[LiveKit] Room service client not configured, skipping room close');
    return;
  }
  try {
    await client.deleteRoom(roomName);
    console.log(`[LiveKit] Room ${roomName} closed`);
  } catch (err) {
    // Room may already be empty/closed
    console.warn(`[LiveKit] Failed to close room ${roomName}:`, err.message);
  }
}

/**
 * Check if LiveKit is configured (API key + secret + URL all set).
 *
 * @returns {boolean}
 */
function isConfigured() {
  return !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL);
}

module.exports = {
  generateToken,
  getRoomServiceClient,
  closeRoom,
  isConfigured,
  LIVEKIT_URL,
};
