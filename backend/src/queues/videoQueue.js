const os = require('os');
const { sqlite } = require('../config/database');
const { processVideo } = require('../services/videoProcessor');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

/** Parse a Redis URL into an IORedis-style connection object. */
function parseRedisConnection(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || '127.0.0.1',
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    return { host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null };
  }
}

const connection = parseRedisConnection(REDIS_URL);

// Check if Redis is reachable before creating BullMQ queue
const net = require('net');
let videoQueue = { add: async () => ({}) };
let bullmqAvailable = false;
let _queueReady = null;

function initQueue() {
  if (_queueReady) return _queueReady;
  _queueReady = new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(1000);
    sock.once('connect', () => {
      sock.destroy();
      try {
        const { Queue } = require('bullmq');
        videoQueue = new Queue('video-processing', {
          connection,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { age: 86400 },
            removeOnFail: { age: 7 * 86400 },
          },
        });
        bullmqAvailable = true;
        console.log('[VideoQueue] Connected to Redis');
      } catch (e) {
        console.warn('[VideoQueue] BullMQ init failed:', e.message);
      }
      resolve();
    });
    sock.once('error', () => {
      sock.destroy();
      console.log('[VideoQueue] Redis not available — using inline processing');
      resolve();
    });
    sock.once('timeout', () => {
      sock.destroy();
      console.log('[VideoQueue] Redis timeout — using inline processing');
      resolve();
    });
    sock.connect(connection.port, connection.host);
  });
  return _queueReady;
}

// Initialize immediately
initQueue();

/**
 * Add a video processing job to the queue.
 * In local dev without Redis, processes the video inline.
 */
async function enqueueVideo(videoId, inputPath) {
  sqlite.prepare("UPDATE videos SET processing_status = 'queued' WHERE id = ?").run(videoId);
  if (bullmqAvailable) {
    try {
      return await videoQueue.add('process', { videoId, inputPath }, { jobId: videoId });
    } catch {
      // Redis not reachable — fall through to inline processing
    }
  }
  // Inline processing fallback (no Redis)
  processVideo({ videoId, inputPath }, () => {}).catch((err) =>
    console.error(`[VideoQueue] Inline processing failed for ${videoId}:`, err.message)
  );
}

/** Start the BullMQ worker. Call once on server startup. */
function startWorker() {
  if (!bullmqAvailable) {
    console.log('[VideoQueue] Redis unavailable — using inline processing fallback');
    return;
  }

  try {
    const { Worker } = require('bullmq');
    const concurrency = Math.max(1, os.cpus().length - 1);

    const worker = new Worker(
      'video-processing',
      async (job) => {
        const { videoId, inputPath } = job.data;
        await processVideo({ videoId, inputPath }, (pct) => {
          job.updateProgress(pct);
        });
      },
      { connection, concurrency }
    );

    worker.on('completed', (job) => {
      console.log(`[VideoQueue] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[VideoQueue] Job ${job?.id} failed: ${err.message}`);
    });

    return worker;
  } catch (err) {
    console.warn('[VideoQueue] Worker failed to start:', err.message);
  }
}

module.exports = { videoQueue, enqueueVideo, startWorker };
