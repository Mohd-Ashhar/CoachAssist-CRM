const Redis = require("ioredis");

let client = null;

try {
  client = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
  });

  client.on("error", () => {
    // Silently degrade — app works fine without Redis
  });
} catch (err) {
  client = null;
}

const getCache = async (key) => {
  if (!client) return null;
  try {
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

const setCache = async (key, data, ttl = 60) => {
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(data), "EX", ttl);
  } catch {
    // noop
  }
};

module.exports = { client, getCache, setCache };
