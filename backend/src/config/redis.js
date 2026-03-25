/**
 * In-memory Redis replacement for local development.
 * Provides the same API surface as the redis client.
 */
const store = new Map();

const memoryRedis = {
  async get(key) {
    return store.get(key) || null;
  },
  async set(key, value) {
    store.set(key, String(value));
    return 'OK';
  },
  async incr(key) {
    const val = parseInt(store.get(key) || '0') + 1;
    store.set(key, String(val));
    return val;
  },
  async decr(key) {
    const val = parseInt(store.get(key) || '0') - 1;
    store.set(key, String(val));
    return val;
  },
  async del(key) {
    store.delete(key);
    return 1;
  },
  async expire() {
    return 1;
  },
  isReady: true,
};

const connectRedis = async () => {
  console.log('Using in-memory store (Redis replacement for local dev)');
};

module.exports = { redisClient: memoryRedis, connectRedis };
