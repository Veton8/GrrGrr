/**
 * LiveKit Webhook Handler
 *
 * Receives room/participant lifecycle events from LiveKit Cloud.
 * Updates viewer counts and stream status in the database.
 *
 * Configure in LiveKit Cloud dashboard:
 *   Webhook URL: https://your-domain.com/api/webhooks/livekit
 *
 * @module routes/webhooks
 */
const express = require('express');
const router = express.Router();
const { WebhookReceiver } = require('livekit-server-sdk');
const { sqlite } = require('../config/database');
const { redisClient } = require('../config/redis');

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

/**
 * POST /api/webhooks/livekit — LiveKit webhook endpoint.
 * Validates signature and handles participant/room events.
 */
router.post('/livekit', express.raw({ type: 'application/webhook+json' }), async (req, res) => {
  try {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(503).json({ error: 'LiveKit not configured' });
    }

    const receiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    // Validate and parse the webhook body
    const body = typeof req.body === 'string' ? req.body : req.body.toString('utf-8');
    const authHeader = req.get('Authorization') || '';
    let event;
    try {
      event = await receiver.receive(body, authHeader);
    } catch (err) {
      console.warn('[Webhook] Invalid LiveKit webhook signature:', err.message);
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const roomName = event.room?.name; // roomName = livestream ID
    console.log(`[LiveKit Webhook] ${event.event} in room ${roomName}`);

    switch (event.event) {
      case 'participant_joined': {
        if (!roomName) break;
        const identity = event.participant?.identity;
        // Don't count the publisher (streamer) as a viewer
        const isPublisher = event.participant?.permission?.canPublish;
        if (!isPublisher) {
          await redisClient.incr(`live:${roomName}:viewers`);
          const count = await redisClient.get(`live:${roomName}:viewers`);
          sqlite
            .prepare('UPDATE livestreams SET viewer_count = ? WHERE id = ? AND is_active = 1')
            .run(parseInt(count) || 0, roomName);
        }
        console.log(`[LiveKit] ${identity} joined room ${roomName}`);
        break;
      }

      case 'participant_left': {
        if (!roomName) break;
        const identity = event.participant?.identity;
        const isPublisher = event.participant?.permission?.canPublish;
        if (!isPublisher) {
          await redisClient.decr(`live:${roomName}:viewers`);
          const count = await redisClient.get(`live:${roomName}:viewers`);
          const safeCount = Math.max(0, parseInt(count) || 0);
          if (safeCount.toString() !== count) {
            await redisClient.set(`live:${roomName}:viewers`, safeCount.toString());
          }
          sqlite
            .prepare('UPDATE livestreams SET viewer_count = ? WHERE id = ? AND is_active = 1')
            .run(safeCount, roomName);
        }
        console.log(`[LiveKit] ${identity} left room ${roomName}`);
        break;
      }

      case 'room_finished': {
        if (!roomName) break;
        // Mark the livestream as ended
        const stream = sqlite
          .prepare('SELECT id, host_id FROM livestreams WHERE id = ? AND is_active = 1')
          .get(roomName);
        if (stream) {
          sqlite
            .prepare("UPDATE livestreams SET is_active = 0, ended_at = datetime('now') WHERE id = ?")
            .run(roomName);
          sqlite.prepare('UPDATE users SET is_live = 0 WHERE id = ?').run(stream.host_id);
          await redisClient.del(`live:${roomName}:viewers`);
          console.log(`[LiveKit] Room ${roomName} finished, stream marked as ended`);
        }
        break;
      }

      default:
        console.log(`[LiveKit Webhook] Unhandled event: ${event.event}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Webhook] Error processing LiveKit webhook:', err);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

module.exports = router;
