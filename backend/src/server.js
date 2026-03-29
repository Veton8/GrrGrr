require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { connectRedis } = require('./config/redis');
const setupWebSocket = require('./websocket');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files (videos, thumbnails, HLS segments)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Bull-Board admin dashboard (requires Redis) ────────────────────────────
app.use('/admin/queues', (req, res) => res.json({ message: 'Queue dashboard requires Redis' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profiles', require('./routes/profile'));
app.use('/api/feed', require('./routes/feed'));
app.use('/api/live', require('./routes/live'));
app.use('/api/gifts', require('./routes/gifts'));
app.use('/api/battles', require('./routes/battles'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/search', require('./routes/search'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/webhooks', require('./routes/webhooks'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await connectRedis();
  } catch (err) {
    console.warn('Redis connection failed, continuing without real-time features:', err.message);
  }

  // Start video processing worker (gracefully skips if Redis unavailable)
  try {
    const { startWorker } = require('./queues/videoQueue');
    startWorker();
    console.log('Video processing worker started');
  } catch (err) {
    console.warn('Video queue worker failed to start:', err.message);
  }

  // Start recommendation scoring job
  try {
    const { startScoringJob } = require('./services/recommendationEngine');
    startScoringJob();
    console.log('Recommendation scoring job started (runs every 15 min)');
  } catch (err) {
    console.warn('Recommendation scoring job failed to start:', err.message);
  }

  const io = setupWebSocket(server);
  app.set('io', io);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on 0.0.0.0:${PORT}`);
    console.log(`Bull-Board admin: http://localhost:${PORT}/admin/queues`);
  });
}

start();
