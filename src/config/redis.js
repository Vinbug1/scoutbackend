import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Two dedicated clients: one publishes, one subscribes (required by the
// Socket.io Redis adapter — a client can't do both at once).
export const pubClient = createClient({ url: REDIS_URL });
export const subClient = pubClient.duplicate();

// General-purpose client for presence, typing-state TTLs, etc.
export const redisClient = createClient({ url: REDIS_URL });

let connected = false;

export async function connectRedis() {
  if (connected) return;
  await Promise.all([
    pubClient.connect(),
    subClient.connect(),
    redisClient.connect(),
  ]);
  connected = true;
  console.log('✅ Connected to Redis (pub/sub + cache clients)');
}

[pubClient, subClient, redisClient].forEach((client) => {
  client.on('error', (err) => console.error('❌ Redis client error:', err));
});