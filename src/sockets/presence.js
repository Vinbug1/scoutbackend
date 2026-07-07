import { redisClient } from '../config/redis.js';
import prisma from '../lib/prisma.js';

// A user can have multiple sockets open (multiple devices/tabs). Track a
// Redis SET of active socket ids per user; only flip DB isOnline to false
// when the LAST socket for that user disconnects.
const socketSetKey = (userId) => `presence:sockets:${userId}`;

export async function markOnline(userId, socketId) {
  await redisClient.sAdd(socketSetKey(userId), socketId);
  await prisma.user.update({
    where: { id: userId },
    data: { isOnline: true },
  });
}

export async function markSocketClosed(userId, socketId) {
  await redisClient.sRem(socketSetKey(userId), socketId);
  const remaining = await redisClient.sCard(socketSetKey(userId));

  if (remaining === 0) {
    const lastSeenAt = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { isOnline: false, lastSeenAt },
    });
    return { wentOffline: true, lastSeenAt };
  }
  return { wentOffline: false };
}