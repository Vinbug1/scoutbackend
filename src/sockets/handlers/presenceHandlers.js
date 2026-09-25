import { redisClient } from '../../config/redis.js';
import prisma from '../../lib/prisma.js';
import {
  watchRoom,
  filterVisibleIds,
  getPresence,
  parseIds,
} from '../../services/presenceService.js';

const MAX_WATCHED_PER_SOCKET = 200;
const OFFLINE_PENDING_TTL_SECONDS = 25;
const OFFLINE_DEBOUNCE_MS = 20_000;

const pendingOfflineKey = (userId) =>
  `presence:pending_offline:${userId}`;

// All chat peers of userId: every other member of every chat room they belong to.
// Presence updates are sent to each peer's personal user:<id> room, never to
// room:<roomId>. This allows inbox users to receive presence updates even when
// they have not opened a conversation.
async function getPeerIds(userId) {
  const memberships = await prisma.chatRoomMember.findMany({
    where: { userId },
    select: { roomId: true },
  });

  const roomIds = memberships.map((membership) => membership.roomId);
  if (roomIds.length === 0) return [];

  const peers = await prisma.chatRoomMember.findMany({
    where: {
      roomId: { in: roomIds },
      userId: { not: userId },
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  return peers.map((peer) => peer.userId);
}

// Peers in the user's 100 most recently active conversations.
// This is the bounded snapshot used by presence:sync.
async function getRecentPeerIds(userId, limit = 100) {
  const memberships = await prisma.chatRoomMember.findMany({
    where: { userId },
    select: {
      room: {
        select: {
          members: {
            where: { userId: { not: userId } },
            select: { userId: true },
          },
        },
      },
    },
    orderBy: {
      room: {
        lastMessage: {
          updatedAt: 'desc',
        },
      },
    },
  });

  const peerIds = [];
  const seen = new Set();

  for (const { room } of memberships) {
    for (const { userId: peerId } of room.members) {
      if (seen.has(peerId)) continue;

      seen.add(peerId);
      peerIds.push(peerId);

      if (peerIds.length >= limit) return peerIds;
    }
  }

  return peerIds;
}

async function isUserOnline(io, userId) {
  const sockets = await io.in(`user:${userId}`).allSockets();
  return sockets.size > 0;
}

// Required presence:update fan-out.
// The recipient is every chat peer of the user whose status changed.
// No follower/profile notification is emitted here.
async function broadcastPresence(io, userId, status) {
  const peerIds = await getPeerIds(userId);

  for (const peerId of peerIds) {
    io.to(`user:${peerId}`).emit('presence:update', {
      userId,
      status,
    });
  }
}

async function emitPresenceSync(io, socket, userId) {
  const peerIds = await getRecentPeerIds(userId, 100);

  const presence = await Promise.all(
    peerIds.map(async (peerId) => ({
      userId: peerId,
      status: (await isUserOnline(io, peerId)) ? 'online' : 'offline',
    }))
  );

  // Emit to this socket only. Do not emit to user:<userId>, because another
  // device for the same user does not need this socket's snapshot.
  socket.emit('presence:sync', { presence });
}

export default function registerPresenceHandlers(io, socket) {
  const userId = socket.user.id;
  const watching = new Set();

  // The socket has already joined user:<userId> in sockets/index.js before
  // this handler is registered. This means the snapshot is computed after the
  // personal room exists, as required by the presence contract.
  markOnline().catch((err) => {
    console.error('presence: markOnline failed', err);
  });

  // Legacy/profile presence watching is kept for compatibility with existing
  // clients. It does NOT generate follower online notifications. Chat presence
  // required by the new contract is handled by presence:sync/update below.
  socket.on('presence:watch', async (payload, ack) => {
    try {
      const requested = parseIds(payload?.userIds).filter((id) => id !== userId);
      const allowed = await filterVisibleIds(userId, requested);

      for (const id of allowed) {
        if (
          watching.size >= MAX_WATCHED_PER_SOCKET &&
          !watching.has(id)
        ) {
          break;
        }

        watching.add(id);
        socket.join(watchRoom(id));
      }

      const presence = await getPresence(
        io,
        allowed.filter((id) => watching.has(id))
      );

      ack?.({ status: 'ok', presence });
    } catch (err) {
      console.error('presence:watch failed', err);
      ack?.({
        status: 'error',
        error: 'Failed to watch presence',
      });
    }
  });

  socket.on('presence:unwatch', (payload) => {
    for (const id of parseIds(
      payload?.userIds,
      MAX_WATCHED_PER_SOCKET
    )) {
      watching.delete(id);
      socket.leave(watchRoom(id));
    }
  });

  socket.on('disconnect', async () => {
    try {
      // Socket.IO has removed the disconnected socket from its rooms by this
      // point. If another device/socket is still in user:<userId>, the user
      // remains online and no offline event should be emitted.
      const remaining = await io.in(`user:${userId}`).allSockets();
      if (remaining.size > 0) return;

      // Keep the existing viewing cleanup independent of presence fan-out.
      const memberships = await prisma.chatRoomMember.findMany({
        where: { userId },
        select: { roomId: true },
      });

      for (const { roomId } of memberships) {
        await redisClient
          .sRem(`viewing:${roomId}`, String(userId))
          .catch((err) => {
            console.error('presence: viewing cleanup failed', err);
          });
      }

      // Delay the offline edge so short mobile/network reconnects do not
      // produce an offline/online flicker.
      await redisClient.set(
        pendingOfflineKey(userId),
        '1',
        { EX: OFFLINE_PENDING_TTL_SECONDS }
      );

      setTimeout(async () => {
        try {
          const stillEmpty =
            (await io.in(`user:${userId}`).allSockets()).size === 0;

          const pendingStillSet = await redisClient.get(
            pendingOfflineKey(userId)
          );

          if (!stillEmpty || !pendingStillSet) return;

          await redisClient.del(pendingOfflineKey(userId));

          // No database isOnline flag is used as presence truth. Socket state
          // is the source of truth. The existing DB fields are intentionally
          // not included in any presence payload.
          await broadcastPresence(io, userId, 'offline');
        } catch (err) {
          console.error(
            'presence: offline debounce fire failed',
            err
          );
        }
      }, OFFLINE_DEBOUNCE_MS);
    } catch (err) {
      console.error('presence: disconnect handling failed', err);
    }
  });

  async function markOnline() {
    // Cancel a pending offline generated by a recent disconnect.
    // Redis DEL returning 1 means the peers never received the offline edge.
    const cancelledPendingOffline =
      (await redisClient.del(pendingOfflineKey(userId))) === 1;

    // Every successful connection receives a fresh snapshot.
    await emitPresenceSync(io, socket, userId);

    // Count after this socket has joined user:<userId>.
    const socketsAfterJoin = await io
      .in(`user:${userId}`)
      .allSockets();

    // Additional device: peers already know this user is online.
    if (socketsAfterJoin.size > 1) return;

    // Reconnected inside the grace period: peers never saw offline, so do not
    // emit another online edge and do not cause a flicker.
    if (cancelledPendingOffline) return;

    // First live socket: this is the actual online transition.
    await broadcastPresence(io, userId, 'online');
  }
}











// import { redisClient } from '../../config/redis.js';
// import prisma from '../../lib/prisma.js';
// import { watchRoom, filterVisibleIds, getPresence, parseIds } from '../../services/presenceService.js';

// const MAX_WATCHED_PER_SOCKET = 200;


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

// // Fan-out: chat peers (their personal `user:<id>` rooms) plus anyone who
// // called `presence:watch` for this user (followers / following on a
// // profile or list screen). Socket.io delivers once per socket even if it
// // matches several of these rooms, so nobody gets a duplicate event.
// async function broadcastPresence(io, userId, status) {
//   const peerIds = await getPeerIds(userId);
//   const rooms = [...peerIds.map((id) => `user:${id}`), watchRoom(userId)];
//   io.to(rooms).emit('presence:update', {
//     userId,
//     status,
//     ...(status === 'offline' ? { lastSeenAt: new Date().toISOString() } : {}),
//   });
// }

// export default function registerPresenceHandlers(io, socket) {
//   const userId = socket.user.id;

//   markOnline().catch((err) => console.error('presence: markOnline failed', err));

//   // ── presence:watch / presence:unwatch ───────────────────────────────
//   // Client calls this when a screen shows other users (profile, followers
//   // list, following list) and gets the current status back in the ack;
//   // later changes arrive as `presence:update`. Only users the caller is
//   // allowed to see (see filterVisibleIds) are joined and returned.
//   const watching = new Set();

//   socket.on('presence:watch', async (payload, ack) => {
//     try {
//       const requested = parseIds(payload?.userIds).filter((id) => id !== userId);
//       const allowed = await filterVisibleIds(userId, requested);

//       for (const id of allowed) {
//         if (watching.size >= MAX_WATCHED_PER_SOCKET && !watching.has(id)) break;
//         watching.add(id);
//         socket.join(watchRoom(id));
//       }

//       const presence = await getPresence(io, allowed.filter((id) => watching.has(id)));
//       ack?.({ status: 'ok', presence });
//     } catch (err) {
//       console.error('presence:watch failed', err);
//       ack?.({ status: 'error', error: 'Failed to watch presence' });
//     }
//   });

//   socket.on('presence:unwatch', (payload) => {
//     for (const id of parseIds(payload?.userIds, MAX_WATCHED_PER_SOCKET)) {
//       watching.delete(id);
//       socket.leave(watchRoom(id));
//     }
//   });

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
//       await redisClient.set(`presence:pending_offline:${userId}`, '1', { EX: 5 });

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
//       }, 5000);
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
























// import { redisClient } from '../../config/redis.js';
// import prisma from '../../lib/prisma.js';
// import { watchRoom, filterVisibleIds, getPresence, parseIds } from '../../services/presenceService.js';
// import notificationService from '../../services/notificationService.js';

// const MAX_WATCHED_PER_SOCKET = 200;

// // Don't re-notify a user's followers more than once per this window. The
// // live presence dot (broadcastPresence, below) can flip on every
// // reconnect — locking/unlocking a phone, backgrounding the app — but a
// // push notification + a permanent row in someone's inbox is a much
// // heavier thing to fire on every one of those flips.
// const ONLINE_NOTIFY_COOLDOWN_SECONDS = 20 * 60;

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

// // Fan-out: chat peers (their personal `user:<id>` rooms) plus anyone who
// // called `presence:watch` for this user (followers / following on a
// // profile or list screen). Socket.io delivers once per socket even if it
// // matches several of these rooms, so nobody gets a duplicate event.
// async function broadcastPresence(io, userId, status) {
//   const peerIds = await getPeerIds(userId);
//   const rooms = [...peerIds.map((id) => `user:${id}`), watchRoom(userId)];
//   io.to(rooms).emit('presence:update', {
//     userId,
//     status,
//     ...(status === 'offline' ? { lastSeenAt: new Date().toISOString() } : {}),
//   });
// }

// export default function registerPresenceHandlers(io, socket) {
//   const userId = socket.user.id;

//   markOnline().catch((err) => console.error('presence: markOnline failed', err));

//   // ── presence:watch / presence:unwatch ───────────────────────────────
//   // Client calls this when a screen shows other users (profile, followers
//   // list, following list) and gets the current status back in the ack;
//   // later changes arrive as `presence:update`. Only users the caller is
//   // allowed to see (see filterVisibleIds) are joined and returned.
//   const watching = new Set();

//   socket.on('presence:watch', async (payload, ack) => {
//     try {
//       const requested = parseIds(payload?.userIds).filter((id) => id !== userId);
//       const allowed = await filterVisibleIds(userId, requested);

//       for (const id of allowed) {
//         if (watching.size >= MAX_WATCHED_PER_SOCKET && !watching.has(id)) break;
//         watching.add(id);
//         socket.join(watchRoom(id));
//       }

//       const presence = await getPresence(io, allowed.filter((id) => watching.has(id)));
//       ack?.({ status: 'ok', presence });
//     } catch (err) {
//       console.error('presence:watch failed', err);
//       ack?.({ status: 'error', error: 'Failed to watch presence' });
//     }
//   });

//   socket.on('presence:unwatch', (payload) => {
//     for (const id of parseIds(payload?.userIds, MAX_WATCHED_PER_SOCKET)) {
//       watching.delete(id);
//       socket.leave(watchRoom(id));
//     }
//   });

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

//     // Notify followers that this user is active now — throttled
//     // separately from the presence dot above. set(..., NX) is atomic,
//     // so concurrent connects (e.g. two tabs racing on markOnline) can't
//     // both pass this check.
//     try {
//       const gotLock = await redisClient.set(
//         `presence:online-notify-cooldown:${userId}`,
//         '1',
//         { NX: true, EX: ONLINE_NOTIFY_COOLDOWN_SECONDS }
//       );
//       if (gotLock) {
//         notificationService
//           .notifyFollowedUserOnline(io, userId)
//           .catch((err) => console.error('presence: notifyFollowedUserOnline failed', err));
//       }
//     } catch (err) {
//       console.error('presence: online-notify cooldown check failed', err);
//     }
//   }
// }


















// import { redisClient } from '../../config/redis.js';
// import prisma from '../../lib/prisma.js';
// import { watchRoom, filterVisibleIds, getPresence, parseIds } from '../../services/presenceService.js';

// const MAX_WATCHED_PER_SOCKET = 200;

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

// // Fan-out: chat peers (their personal `user:<id>` rooms) plus anyone who
// // called `presence:watch` for this user (followers / following on a
// // profile or list screen). Socket.io delivers once per socket even if it
// // matches several of these rooms, so nobody gets a duplicate event.
// async function broadcastPresence(io, userId, status) {
//   const peerIds = await getPeerIds(userId);
//   const rooms = [...peerIds.map((id) => `user:${id}`), watchRoom(userId)];
//   io.to(rooms).emit('presence:update', {
//     userId,
//     status,
//     ...(status === 'offline' ? { lastSeenAt: new Date().toISOString() } : {}),
//   });
// }

// export default function registerPresenceHandlers(io, socket) {
//   const userId = socket.user.id;

//   markOnline().catch((err) => console.error('presence: markOnline failed', err));

//   // ── presence:watch / presence:unwatch ───────────────────────────────
//   // Client calls this when a screen shows other users (profile, followers
//   // list, following list) and gets the current status back in the ack;
//   // later changes arrive as `presence:update`. Only users the caller is
//   // allowed to see (see filterVisibleIds) are joined and returned.
//   const watching = new Set();

//   socket.on('presence:watch', async (payload, ack) => {
//     try {
//       const requested = parseIds(payload?.userIds).filter((id) => id !== userId);
//       const allowed = await filterVisibleIds(userId, requested);

//       for (const id of allowed) {
//         if (watching.size >= MAX_WATCHED_PER_SOCKET && !watching.has(id)) break;
//         watching.add(id);
//         socket.join(watchRoom(id));
//       }

//       const presence = await getPresence(io, allowed.filter((id) => watching.has(id)));
//       ack?.({ status: 'ok', presence });
//     } catch (err) {
//       console.error('presence:watch failed', err);
//       ack?.({ status: 'error', error: 'Failed to watch presence' });
//     }
//   });

//   socket.on('presence:unwatch', (payload) => {
//     for (const id of parseIds(payload?.userIds, MAX_WATCHED_PER_SOCKET)) {
//       watching.delete(id);
//       socket.leave(watchRoom(id));
//     }
//   });

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


