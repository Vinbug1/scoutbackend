import { redisClient } from '../../config/redis.js';
import prisma from '../../lib/prisma.js';

export default function registerPresenceHandlers(io, socket) {
  const userId = socket.user.id;

  markOnline().catch((err) => console.error('presence: markOnline failed', err));

  socket.on('disconnect', async () => {
    try {
      const remaining = await io.in(`user:${userId}`).allSockets();
      if (remaining.size > 0) return; // another device/tab is still connected

      await redisClient.set(`presence:${userId}`, JSON.stringify({ status: 'offline', lastSeenAt: new Date().toISOString() }));
      await prisma.user.update({ where: { id: userId }, data: { isOnline: false, lastSeenAt: new Date() } }).catch(() => {});

      const memberships = await prisma.chatRoomMember.findMany({
        where: { userId },
        select: { roomId: true },
      });
      for (const { roomId } of memberships) {
        socket.to(`room:${roomId}`).emit('presence:update', { userId, status: 'offline' });
        // REPLACE WITH:
        await redisClient.sRem(`viewing:${roomId}`, String(userId)); // sRem, not srem
      }
    } catch (err) {
      console.error('presence: disconnect handling failed', err);
    }
  });

  async function markOnline() {
    await redisClient.set(`presence:${userId}`, JSON.stringify({ status: 'online' }));
    await prisma.user.update({ where: { id: userId }, data: { isOnline: true } }).catch(() => {});

    const memberships = await prisma.chatRoomMember.findMany({
      where: { userId },
      select: { roomId: true },
    });
    for (const { roomId } of memberships) {
      socket.to(`room:${roomId}`).emit('presence:update', { userId, status: 'online' });
    }
  }
}


