import prisma from '../lib/prisma.js';

export const watchRoom = (userId) => `presence:watch:${userId}`;

// Socket.IO is the only source of truth for live presence. The Redis adapter
// makes allSockets() multi-instance safe.
async function isConnected(io, userId) {
  const sockets = await io.in(`user:${userId}`).allSockets();
  return sockets.size > 0;
}

/**
 * Existing visibility rule for the optional presence:watch contract.
 * Chat presence itself is always fanned out using chat-room membership.
 */
export async function filterVisibleIds(viewerId, ids) {
  if (ids.length === 0) return [];

  const [follows, myRooms] = await Promise.all([
    prisma.follower.findMany({
      where: {
        OR: [
          {
            followerId: viewerId,
            followedId: { in: ids },
          },
          {
            followedId: viewerId,
            followerId: { in: ids },
          },
        ],
      },
      select: {
        followerId: true,
        followedId: true,
      },
    }),
    prisma.chatRoomMember.findMany({
      where: { userId: viewerId },
      select: { roomId: true },
    }),
  ]);

  const visible = new Set();

  for (const follow of follows) {
    visible.add(
      follow.followerId === viewerId
        ? follow.followedId
        : follow.followerId
    );
  }

  if (myRooms.length > 0) {
    const sharedRoomPeers = await prisma.chatRoomMember.findMany({
      where: {
        roomId: { in: myRooms.map((room) => room.roomId) },
        userId: { in: ids },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    for (const peer of sharedRoomPeers) {
      visible.add(peer.userId);
    }
  }

  return ids.filter((id) => visible.has(id));
}

/**
 * Returns live socket presence only.
 *
 * Important: the payload intentionally contains ONLY:
 *   { userId, status }
 *
 * No lastSeenAt, timestamps, database isOnline flag, or other fields belong
 * to the socket presence contract.
 */
export async function getPresence(io, ids) {
  if (ids.length === 0) return [];

  const statuses = await Promise.all(
    ids.map((id) => isConnected(io, id))
  );

  return ids.map((id, index) => ({
    userId: id,
    status: statuses[index] ? 'online' : 'offline',
  }));
}

export function parseIds(input, max = 100) {
  if (!Array.isArray(input)) return [];

  return [
    ...new Set(
      input
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ].slice(0, max);
}
















// import prisma from '../lib/prisma.js';

// export const watchRoom = (userId) => `presence:watch:${userId}`;

// // Live status comes from the sockets themselves (works across instances
// // through the Redis adapter), never from the isOnline column, which can go
// // stale after a crash.
// async function isConnected(io, userId) {
//   return (await io.in(`user:${userId}`).allSockets()).size > 0;
// }

// /**
//  * Which of `ids` may `viewerId` see presence for?
//  * Rule: there is a follow relationship in either direction, or they share
//  * a chat room. To make presence public to every logged-in user, change
//  * this function to `return ids`.
//  */
// export async function filterVisibleIds(viewerId, ids) {
//   if (ids.length === 0) return [];

//   const [follows, myRooms] = await Promise.all([
//     prisma.follower.findMany({
//       where: {
//         OR: [
//           { followerId: viewerId, followedId: { in: ids } },
//           { followedId: viewerId, followerId: { in: ids } },
//         ],
//       },
//       select: { followerId: true, followedId: true },
//     }),
//     prisma.chatRoomMember.findMany({ where: { userId: viewerId }, select: { roomId: true } }),
//   ]);

//   const visible = new Set();
//   for (const f of follows) visible.add(f.followerId === viewerId ? f.followedId : f.followerId);

//   if (myRooms.length > 0) {
//     const sharedRoomPeers = await prisma.chatRoomMember.findMany({
//       where: { roomId: { in: myRooms.map((r) => r.roomId) }, userId: { in: ids } },
//       select: { userId: true },
//       distinct: ['userId'],
//     });
//     sharedRoomPeers.forEach((p) => visible.add(p.userId));
//   }

//   return ids.filter((id) => visible.has(id));
// }

// export async function getPresence(io, ids) {
//   if (ids.length === 0) return [];

//   const [statuses, users] = await Promise.all([
//     Promise.all(ids.map((id) => isConnected(io, id))),
//     prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, lastSeenAt: true } }),
//   ]);
//   const lastSeen = new Map(users.map((u) => [u.id, u.lastSeenAt]));

//   return ids.map((id, i) => ({
//     userId: id,
//     status: statuses[i] ? 'online' : 'offline',
//     lastSeenAt: statuses[i] ? null : lastSeen.get(id) ?? null,
//   }));
// }

// export function parseIds(input, max = 100) {
//   if (!Array.isArray(input)) return [];
//   return [...new Set(input.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, max);
// }














// // import prisma from '../lib/prisma.js';

// // export const watchRoom = (userId) => `presence:watch:${userId}`;

// // // Live status comes from the sockets themselves (works across instances
// // // through the Redis adapter), never from the isOnline column, which can go
// // // stale after a crash.
// // async function isConnected(io, userId) {
// //   return (await io.in(`user:${userId}`).allSockets()).size > 0;
// // }

// // /**
// //  * Which of `ids` may `viewerId` see presence for?
// //  * Rule: there is a follow relationship in either direction, or they share
// //  * a chat room. To make presence public to every logged-in user, change
// //  * this function to `return ids`.
// //  */
// // export async function filterVisibleIds(viewerId, ids) {
// //   if (ids.length === 0) return [];

// //   const [follows, myRooms] = await Promise.all([
// //     prisma.follower.findMany({
// //       where: {
// //         OR: [
// //           { followerId: viewerId, followedId: { in: ids } },
// //           { followedId: viewerId, followerId: { in: ids } },
// //         ],
// //       },
// //       select: { followerId: true, followedId: true },
// //     }),
// //     prisma.chatRoomMember.findMany({ where: { userId: viewerId }, select: { roomId: true } }),
// //   ]);

// //   const visible = new Set();
// //   for (const f of follows) visible.add(f.followerId === viewerId ? f.followedId : f.followerId);

// //   if (myRooms.length > 0) {
// //     const sharedRoomPeers = await prisma.chatRoomMember.findMany({
// //       where: { roomId: { in: myRooms.map((r) => r.roomId) }, userId: { in: ids } },
// //       select: { userId: true },
// //       distinct: ['userId'],
// //     });
// //     sharedRoomPeers.forEach((p) => visible.add(p.userId));
// //   }

// //   return ids.filter((id) => visible.has(id));
// // }

// // export async function getPresence(io, ids) {
// //   if (ids.length === 0) return [];

// //   const [statuses, users] = await Promise.all([
// //     Promise.all(ids.map((id) => isConnected(io, id))),
// //     prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, lastSeenAt: true } }),
// //   ]);
// //   const lastSeen = new Map(users.map((u) => [u.id, u.lastSeenAt]));

// //   return ids.map((id, i) => ({
// //     userId: id,
// //     status: statuses[i] ? 'online' : 'offline',
// //     lastSeenAt: statuses[i] ? null : lastSeen.get(id) ?? null,
// //   }));
// // }

// // export function parseIds(input, max = 100) {
// //   if (!Array.isArray(input)) return [];
// //   return [...new Set(input.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, max);
// // }