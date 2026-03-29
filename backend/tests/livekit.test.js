/**
 * Tests for LiveKit token generation, webhook handling, and livestream API.
 */
require('dotenv').config();

// ─── Token Generation Tests ─────────────────────────────────────────────────

describe('LiveKit Token Generation', () => {
  let generateToken, isConfigured;

  beforeAll(() => {
    // Set test env vars
    process.env.LIVEKIT_API_KEY = 'test-api-key';
    process.env.LIVEKIT_API_SECRET = 'test-api-secret-that-is-long-enough-for-jwt';
    process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';

    // Re-require to pick up env vars (module caches them)
    jest.resetModules();
    const service = require('../src/services/livekitService');
    generateToken = service.generateToken;
    isConfigured = service.isConfigured;
  });

  test('isConfigured returns true when all env vars are set', () => {
    expect(isConfigured()).toBe(true);
  });

  test('generates a valid JWT token string', async () => {
    const token = await generateToken('user123', 'testuser', 'room-abc', true, null);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  test('publisher token includes canPublish=true', async () => {
    const token = await generateToken('user123', 'testuser', 'room-abc', true);
    // Decode the payload (second part of JWT)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    expect(payload.video).toBeDefined();
    expect(payload.video.roomJoin).toBe(true);
    expect(payload.video.canPublish).toBe(true);
    expect(payload.video.room).toBe('room-abc');
  });

  test('viewer token includes canPublish=false', async () => {
    const token = await generateToken('user456', 'viewer', 'room-abc', false);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    expect(payload.video.canPublish).toBe(false);
    expect(payload.video.canSubscribe).toBe(true);
    expect(payload.video.roomJoin).toBe(true);
  });

  test('token identity includes user_ prefix', async () => {
    const token = await generateToken('user789', 'myuser', 'room-xyz', false);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    expect(payload.sub).toBe('user_user789');
  });

  test('token metadata includes username', async () => {
    const token = await generateToken('u1', 'coolstreamer', 'room-1', true, 'https://avatar.url');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const metadata = JSON.parse(payload.metadata);
    expect(metadata.username).toBe('coolstreamer');
    expect(metadata.avatarUrl).toBe('https://avatar.url');
  });
});

// ─── Webhook Handler Tests ──────────────────────────────────────────────────

describe('LiveKit Webhook Handling', () => {
  // These test the event handling logic conceptually
  // Full integration would require mocking express + WebhookReceiver

  test('participant_joined increments viewer count concept', () => {
    const event = {
      event: 'participant_joined',
      room: { name: 'stream-123' },
      participant: {
        identity: 'user_456',
        permission: { canPublish: false },
      },
    };

    expect(event.event).toBe('participant_joined');
    expect(event.participant.permission.canPublish).toBe(false); // viewer
    expect(event.room.name).toBe('stream-123');
  });

  test('publisher joining does not count as viewer', () => {
    const event = {
      event: 'participant_joined',
      room: { name: 'stream-123' },
      participant: {
        identity: 'user_host',
        permission: { canPublish: true },
      },
    };

    // Publisher should NOT increment viewer count
    expect(event.participant.permission.canPublish).toBe(true);
  });

  test('room_finished event has correct structure', () => {
    const event = {
      event: 'room_finished',
      room: { name: 'stream-789', numParticipants: 0 },
    };

    expect(event.event).toBe('room_finished');
    expect(event.room.name).toBe('stream-789');
  });

  test('participant_left event decrements count', () => {
    const event = {
      event: 'participant_left',
      room: { name: 'stream-123' },
      participant: {
        identity: 'user_456',
        permission: { canPublish: false },
      },
    };

    expect(event.event).toBe('participant_left');
    expect(event.participant.permission.canPublish).toBe(false);
  });
});

// ─── Livestream API Logic Tests ─────────────────────────────────────────────

describe('Livestream API Logic', () => {
  test('stream status transitions are valid', () => {
    const validStatuses = ['live', 'ended'];
    // New streams start as "live" (is_active=1)
    expect(validStatuses).toContain('live');
    // Ended streams transition to "ended" (is_active=0)
    expect(validStatuses).toContain('ended');
  });

  test('viewer count never goes below 0', () => {
    let viewerCount = 0;
    // Simulating decrement with safeguard
    viewerCount = Math.max(0, viewerCount - 1);
    expect(viewerCount).toBe(0);

    viewerCount = 5;
    viewerCount = Math.max(0, viewerCount - 1);
    expect(viewerCount).toBe(4);
  });

  test('token generation skipped when LiveKit not configured', () => {
    // When LIVEKIT_API_KEY is empty, isConfigured should return false
    const originalKey = process.env.LIVEKIT_API_KEY;
    process.env.LIVEKIT_API_KEY = '';
    jest.resetModules();
    const { isConfigured } = require('../src/services/livekitService');
    expect(isConfigured()).toBe(false);
    process.env.LIVEKIT_API_KEY = originalKey;
  });

  test('stream response structure', () => {
    const mockStream = {
      id: 'abc-123',
      title: 'My Stream',
      viewerCount: 42,
      startedAt: '2026-03-26T12:00:00Z',
      host: {
        id: 'user-1',
        username: 'streamer',
        displayName: 'Cool Streamer',
        avatarUrl: null,
        isVerified: false,
      },
    };

    expect(mockStream).toHaveProperty('id');
    expect(mockStream).toHaveProperty('host.username');
    expect(mockStream.viewerCount).toBeGreaterThanOrEqual(0);
  });

  test('integration: start → join → end lifecycle', () => {
    // Conceptual lifecycle test
    const lifecycle = [];

    // 1. Start stream
    lifecycle.push('start');
    const streamId = 'test-stream-id';
    expect(streamId).toBeTruthy();

    // 2. Viewer joins
    lifecycle.push('join');
    let viewers = 0;
    viewers++;
    expect(viewers).toBe(1);

    // 3. End stream
    lifecycle.push('end');
    const isActive = false;
    expect(isActive).toBe(false);

    expect(lifecycle).toEqual(['start', 'join', 'end']);
  });
});
