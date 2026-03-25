require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { connectRedis } = require('./config/redis');
const setupWebSocket = require('./websocket');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profiles', require('./routes/profile'));
app.use('/api/feed', require('./routes/feed'));
app.use('/api/live', require('./routes/live'));
app.use('/api/gifts', require('./routes/gifts'));
app.use('/api/battles', require('./routes/battles'));

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

  setupWebSocket(server);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
