import { redisClient } from '../../config/redis.js';
import prisma from '../../lib/prisma.js';
import { watchRoom, filterVisibleIds, getPresence, parseIds } from '../../services/presenceService.js';

const MAX_WATCHED_PER_SOCKET = 200;

// All peers of userId — every other member of every chat room they belong
// to. Used for the full presence:update fan-out (spec §4).
async function getPeerIds(userId) {
  const memberships = await prisma.chatRoomMember.findMany({
    where: { userId },
    select: { roomId: true },
  });
  const roomIds = memberships.map((m) => m.roomId);
  if (roomIds.length === 0) return [];

  const peers = await prisma.chatRoomMember.findMany({
    where: { roomId: { in: roomIds }, userId: { not: userId } },
    select: { userId: true },
    distinct: ['userId'],
  });
  return peers.map((p) => p.userId);
}

// Peers of the user's most recently active conversations, most recent
// first, deduplicated, capped at `limit` (spec §3). "Recently active" is
// approximated by ChatLastMessage.updatedAt — adjust if you have a
// better recency signal.
async function getRecentPeerIds(userId, limit = 100) {
  const memberships = await prisma.chatRoomMember.findMany({
    where: { userId },
    select: {
      room: {
        select: {
          members: { where: { userId: { not: userId } }, select: { userId: true } },
        },
      },
    },
    orderBy: { room: { lastMessage: { updatedAt: 'desc' } } },
  });

  const peerIds = [];
  const seen = new Set();
  for (const { room } of memberships) {
    for (const { userId: peerId } of room.members) {
      if (!seen.has(peerId)) {
        seen.add(peerId);
        peerIds.push(peerId);
        if (peerIds.length >= limit) return peerIds;
      }
    }
  }
  return peerIds;
}

// Fan-out: chat peers (their personal `user:<id>` rooms) plus anyone who
// called `presence:watch` for this user (followers / following on a
// profile or list screen). Socket.io delivers once per socket even if it
// matches several of these rooms, so nobody gets a duplicate event.
async function broadcastPresence(io, userId, status) {
  const peerIds = await getPeerIds(userId);
  const rooms = [...peerIds.map((id) => `user:${id}`), watchRoom(userId)];
  io.to(rooms).emit('presence:update', {
    userId,
    status,
    ...(status === 'offline' ? { lastSeenAt: new Date().toISOString() } : {}),
  });
}

export default function registerPresenceHandlers(io, socket) {
  const userId = socket.user.id;

  markOnline().catch((err) => console.error('presence: markOnline failed', err));

  // ── presence:watch / presence:unwatch ───────────────────────────────
  // Client calls this when a screen shows other users (profile, followers
  // list, following list) and gets the current status back in the ack;
  // later changes arrive as `presence:update`. Only users the caller is
  // allowed to see (see filterVisibleIds) are joined and returned.
  const watching = new Set();

  socket.on('presence:watch', async (payload, ack) => {
    try {
      const requested = parseIds(payload?.userIds).filter((id) => id !== userId);
      const allowed = await filterVisibleIds(userId, requested);

      for (const id of allowed) {
        if (watching.size >= MAX_WATCHED_PER_SOCKET && !watching.has(id)) break;
        watching.add(id);
        socket.join(watchRoom(id));
      }

      const presence = await getPresence(io, allowed.filter((id) => watching.has(id)));
      ack?.({ status: 'ok', presence });
    } catch (err) {
      console.error('presence:watch failed', err);
      ack?.({ status: 'error', error: 'Failed to watch presence' });
    }
  });

  socket.on('presence:unwatch', (payload) => {
    for (const id of parseIds(payload?.userIds, MAX_WATCHED_PER_SOCKET)) {
      watching.delete(id);
      socket.leave(watchRoom(id));
    }
  });

  socket.on('disconnect', async () => {
    try {
      const remaining = await io.in(`user:${userId}`).allSockets();
      if (remaining.size > 0) return; // another device/tab is still connected

      const memberships = await prisma.chatRoomMember.findMany({
        where: { userId },
        select: { roomId: true },
      });

      // Unrelated "viewing" cleanup — kept as-is, just no longer tied to
      // the presence broadcast loop below.
      for (const { roomId } of memberships) {
        await redisClient.sRem(`viewing:${roomId}`, String(userId));
      }

      // Offline debounce (spec §6) — don't broadcast offline immediately;
      // schedule it, and let a reconnect within the window cancel it.
      await redisClient.set(`presence:pending_offline:${userId}`, '1', { EX: 25 });

      setTimeout(async () => {
        try {
          const stillEmpty = (await io.in(`user:${userId}`).allSockets()).size === 0;
          const pendingStillSet = await redisClient.get(`presence:pending_offline:${userId}`);
          if (!stillEmpty || !pendingStillSet) return; // a reconnect already cancelled this

          await redisClient.del(`presence:pending_offline:${userId}`);
          await redisClient.set(`presence:${userId}`, JSON.stringify({ status: 'offline' }));
          await prisma.user
            .update({ where: { id: userId }, data: { isOnline: false, lastSeenAt: new Date() } })
            .catch(() => {});

          await broadcastPresence(io, userId, 'offline');
        } catch (err) {
          console.error('presence: offline debounce fire failed', err);
        }
      }, 20000);
    } catch (err) {
      console.error('presence: disconnect handling failed', err);
    }
  });

  async function markOnline() {
    // Cancel any pending offline from a very recent disconnect. del()
    // returns 1 if the key existed (i.e. a pending offline was cancelled).
    const cancelledPendingOffline = (await redisClient.del(`presence:pending_offline:${userId}`)) === 1;

    await redisClient.set(`presence:${userId}`, JSON.stringify({ status: 'online' }));
    await prisma.user.update({ where: { id: userId }, data: { isOnline: true } }).catch(() => {});

    // presence:sync (spec §3) — snapshot for this connecting socket only.
    // NOTE: assumes the socket has already joined `user:<userId>` by this
    // point (see flag #1 above). Move this block if that join happens later.
    try {
      const peerIds = await getRecentPeerIds(userId, 100);
      const presence = await Promise.all(
        peerIds.map(async (id) => ({
          userId: id,
          status: (await io.in(`user:${id}`).allSockets()).size > 0 ? 'online' : 'offline',
        }))
      );
      socket.emit('presence:sync', { presence });
    } catch (err) {
      console.error('presence: sync emit failed', err);
    }

    // Fan-out decision (spec §6, "on connect"):
    const socketsAfterJoin = await io.in(`user:${userId}`).allSockets();
    if (socketsAfterJoin.size > 1) return; // additional device — peers already see this user online
    if (cancelledPendingOffline) return;   // peers never saw offline — emit nothing

    await broadcastPresence(io, userId, 'online');
  }
}















// import { redisClient } from '../../config/redis.js';
// import prisma from '../../lib/prisma.js';

// export default function registerPresenceHandlers(io, socket) {
//   const userId = socket.user.id;

//   markOnline().catch((err) => console.error('presence: markOnline failed', err));

//   socket.on('disconnect', async () => {
//     try {
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
//         // REPLACE WITH:
//         await redisClient.sRem(`viewing:${roomId}`, String(userId)); // sRem, not srem
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











// import { redisClient } from '../../config/redis.js';
// import prisma from '../../lib/prisma.js';

// // All peers of userId — every other member of every chat room they belong
// // to. Used for the full presence:update fan-out (spec §4).
// async function getPeerIds(userId) {
//   const memberships = await prisma.chatRoomMember.findMany({
//     where: { userId },
//     select: { roomId: true },
//   });
//   const roomIds = memberships.map((m) => m.roomId);
//   if (roomIds.length === 0) return [];

//   const peers = await prisma.chatRoomMember.findMany({
//     where: { roomId: { in: roomIds }, userId: { not: userId } },
//     select: { userId: true },
//     distinct: ['userId'],
//   });
//   return peers.map((p) => p.userId);
// }

// // Peers of the user's most recently active conversations, most recent
// // first, deduplicated, capped at `limit` (spec §3). "Recently active" is
// // approximated by ChatLastMessage.updatedAt — adjust if you have a
// // better recency signal.
// async function getRecentPeerIds(userId, limit = 100) {
//   const memberships = await prisma.chatRoomMember.findMany({
//     where: { userId },
//     select: {
//       room: {
//         select: {
//           members: { where: { userId: { not: userId } }, select: { userId: true } },
//         },
//       },
//     },
//     orderBy: { room: { lastMessage: { updatedAt: 'desc' } } },
//   });

//   const peerIds = [];
//   const seen = new Set();
//   for (const { room } of memberships) {
//     for (const { userId: peerId } of room.members) {
//       if (!seen.has(peerId)) {
//         seen.add(peerId);
//         peerIds.push(peerId);
//         if (peerIds.length >= limit) return peerIds;
//       }
//     }
//   }
//   return peerIds;
// }

// // Peer-scoped fan-out (spec §4) — replaces the old room:<roomId> broadcast.
// async function broadcastPresence(io, userId, status) {
//   const peerIds = await getPeerIds(userId);
//   for (const peerId of peerIds) {
//     io.to(`user:${peerId}`).emit('presence:update', { userId, status });
//   }
// }

// export default function registerPresenceHandlers(io, socket) {
//   const userId = socket.user.id;

//   markOnline().catch((err) => console.error('presence: markOnline failed', err));

//   socket.on('disconnect', async () => {
//     try {
//       const remaining = await io.in(`user:${userId}`).allSockets();
//       if (remaining.size > 0) return; // another device/tab is still connected

//       const memberships = await prisma.chatRoomMember.findMany({
//         where: { userId },
//         select: { roomId: true },
//       });

//       // Unrelated "viewing" cleanup — kept as-is, just no longer tied to
//       // the presence broadcast loop below.
//       for (const { roomId } of memberships) {
//         await redisClient.sRem(`viewing:${roomId}`, String(userId));
//       }

//       // Offline debounce (spec §6) — don't broadcast offline immediately;
//       // schedule it, and let a reconnect within the window cancel it.
//       await redisClient.set(`presence:pending_offline:${userId}`, '1', { EX: 25 });

//       setTimeout(async () => {
//         try {
//           const stillEmpty = (await io.in(`user:${userId}`).allSockets()).size === 0;
//           const pendingStillSet = await redisClient.get(`presence:pending_offline:${userId}`);
//           if (!stillEmpty || !pendingStillSet) return; // a reconnect already cancelled this

//           await redisClient.del(`presence:pending_offline:${userId}`);
//           await redisClient.set(`presence:${userId}`, JSON.stringify({ status: 'offline' }));
//           await prisma.user
//             .update({ where: { id: userId }, data: { isOnline: false, lastSeenAt: new Date() } })
//             .catch(() => {});

//           await broadcastPresence(io, userId, 'offline');
//         } catch (err) {
//           console.error('presence: offline debounce fire failed', err);
//         }
//       }, 20000);
//     } catch (err) {
//       console.error('presence: disconnect handling failed', err);
//     }
//   });

//   async function markOnline() {
//     // Cancel any pending offline from a very recent disconnect. del()
//     // returns 1 if the key existed (i.e. a pending offline was cancelled).
//     const cancelledPendingOffline = (await redisClient.del(`presence:pending_offline:${userId}`)) === 1;

//     await redisClient.set(`presence:${userId}`, JSON.stringify({ status: 'online' }));
//     await prisma.user.update({ where: { id: userId }, data: { isOnline: true } }).catch(() => {});

//     // presence:sync (spec §3) — snapshot for this connecting socket only.
//     // NOTE: assumes the socket has already joined `user:<userId>` by this
//     // point (see flag #1 above). Move this block if that join happens later.
//     try {
//       const peerIds = await getRecentPeerIds(userId, 100);
//       const presence = await Promise.all(
//         peerIds.map(async (id) => ({
//           userId: id,
//           status: (await io.in(`user:${id}`).allSockets()).size > 0 ? 'online' : 'offline',
//         }))
//       );
//       socket.emit('presence:sync', { presence });
//     } catch (err) {
//       console.error('presence: sync emit failed', err);
//     }

//     // Fan-out decision (spec §6, "on connect"):
//     const socketsAfterJoin = await io.in(`user:${userId}`).allSockets();
//     if (socketsAfterJoin.size > 1) return; // additional device — peers already see this user online
//     if (cancelledPendingOffline) return;   // peers never saw offline — emit nothing

//     await broadcastPresence(io, userId, 'online');
//   }
// }















// // import { redisClient } from '../../config/redis.js';
// // import prisma from '../../lib/prisma.js';

// // export default function registerPresenceHandlers(io, socket) {
// //   const userId = socket.user.id;

// //   markOnline().catch((err) => console.error('presence: markOnline failed', err));

// //   socket.on('disconnect', async () => {
// //     try {
// //       const remaining = await io.in(`user:${userId}`).allSockets();
// //       if (remaining.size > 0) return; // another device/tab is still connected

// //       await redisClient.set(`presence:${userId}`, JSON.stringify({ status: 'offline', lastSeenAt: new Date().toISOString() }));
// //       await prisma.user.update({ where: { id: userId }, data: { isOnline: false, lastSeenAt: new Date() } }).catch(() => {});

// //       const memberships = await prisma.chatRoomMember.findMany({
// //         where: { userId },
// //         select: { roomId: true },
// //       });
// //       for (const { roomId } of memberships) {
// //         socket.to(`room:${roomId}`).emit('presence:update', { userId, status: 'offline' });
// //         // REPLACE WITH:
// //         await redisClient.sRem(`viewing:${roomId}`, String(userId)); // sRem, not srem
// //       }
// //     } catch (err) {
// //       console.error('presence: disconnect handling failed', err);
// //     }
// //   });

// //   async function markOnline() {
// //     await redisClient.set(`presence:${userId}`, JSON.stringify({ status: 'online' }));
// //     await prisma.user.update({ where: { id: userId }, data: { isOnline: true } }).catch(() => {});

// //     const memberships = await prisma.chatRoomMember.findMany({
// //       where: { userId },
// //       select: { roomId: true },
// //     });
// //     for (const { roomId } of memberships) {
// //       socket.to(`room:${roomId}`).emit('presence:update', { userId, status: 'online' });
// //     }
// //   }
// // }


