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













// import { redisClient } from '../../config/redis.js';
// import prisma from '../../lib/prisma.js';

// // ⚠️ ASSUMPTION — this imports `../lib/redis.js` as a default-exported
// // client with an ioredis-style API (.set/.get/.sadd/.srem/.sismember).
// // Your memory notes you already integrated a Socket.io + Redis layer
// // recently, so this almost certainly already exists — just confirm the
// // import path and method names match what you actually have. If you're
// // on node-redis instead of ioredis, the calls below are the same method
// // names but you'll want `await redisClient.connect()` handled wherever
// // that client is constructed, not here.
// export default function registerPresenceHandlers(io, socket) {
//   const userId = socket.user.id;

//   markOnline().catch((err) => console.error('presence: markOnline failed', err));

//   // NOTE on timing: Socket.io fires 'disconnect' AFTER the socket has
//   // already been removed from all its rooms (unlike 'disconnecting',
//   // which fires before). That means by the time this handler runs,
//   // `io.in(user:${userId}).allSockets()` already reflects ONLY this
//   // user's OTHER remaining connections — which is exactly what makes the
//   // multi-device check below correct without any extra bookkeeping.
//   socket.on('disconnect', async () => {
//     try {
//       // allSockets() is adapter-aware — with the Redis adapter wired in
//       // (spec §5.1), this correctly reflects sockets on OTHER server
//       // instances too, not just this process. A naive local-only check
//       // (e.g. inspecting io.sockets.adapter.rooms directly) would NOT.
//       const remaining = await io.in(`user:${userId}`).allSockets();
//       if (remaining.size > 0) return; // another device/tab is still connected

//       await redisClient.set(`presence:${userId}`, JSON.stringify({ status: 'offline', lastSeenAt: new Date().toISOString() }));
//       await prisma.user.update({ where: { id: userId }, data: { isOnline: false, lastSeenAt: new Date() } }).catch(() => {});

//       const memberships = await prisma.chatRoomMember.findMany({
//         where: { userId },
//         select: { roomId: true },
//       });
//       for (const { roomId } of memberships) {
//         socket.to(`room:${roomId}`).emit('presence:update', { userId, status: 'offline' });
//         await redisClient.srem(`viewing:${roomId}`, userId);
//       }
//     } catch (err) {
//       console.error('presence: disconnect handling failed', err);
//     }
    
//   });

//   async function markOnline() {
//     await redisClient.set(`presence:${userId}`, JSON.stringify({ status: 'online' }));
//     await prisma.user.update({ where: { id: userId }, data: { isOnline: true } }).catch(() => {});

//     const memberships = await prisma.chatRoomMember.findMany({
//       where: { userId },
//       select: { roomId: true },
//     });
//     for (const { roomId } of memberships) {
//       socket.to(`room:${roomId}`).emit('presence:update', { userId, status: 'online' });
//     }
//   }
// }










