import prisma from '../lib/prisma.js';
import { sendPushNotification, PushNotificationType } from './pushNotificationService.js';

const ACTOR_SELECT = {
  id: true,
  fullname: true,
  role: true,
  profile: { select: { avatarUrl: true } },
  scoutProfile: { select: { avatarUrl: true } },
};

function formatActor(user) {
  if (!user) return null;
  return {
    id: user.id,
    fullname: user.fullname,
    role: user.role,
    avatarUrl: user.profile?.avatarUrl ?? user.scoutProfile?.avatarUrl ?? null,
  };
}

function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '';
  const s = Math.max(Math.round(seconds), 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Enhanced notifyUser emitting real-time socket events
 */
async function notifyUser(io, { type, role, recipientId, actorUserId = null, title, body, fields = {} }) {
  let notification;
  try {
    notification = await prisma.notification.create({
      data: { type, role, recipientId, actorUserId, title, body, data: {} },
    });
  } catch (err) {
    console.error(
      `notifyUser create failed — type=${type} role=${role} recipientId=${recipientId} actorUserId=${actorUserId}`,
      err.code, err.message, err.meta
    );
    throw err;
  }

  const payload = {
    type,
    role,
    recipientId: String(recipientId),
    ...(actorUserId != null ? { actorUserId: String(actorUserId) } : {}),
    title,
    body,
    ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])),
    notificationId: String(notification.id),
  };

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { data: payload },
    include: { actor: { select: ACTOR_SELECT } },
  });

  sendPushNotification(payload).catch((err) =>
    console.error(`Failed to send ${type} push to user ${recipientId}:`, err)
  );

  const { count: unreadCount } = await notificationService.unreadCount(recipientId);

  if (io) {
    const formattedNotification = {
      id: updated.id,
      read: updated.read,
      createdAt: updated.createdAt,
      actor: formatActor(updated.actor),
      data: updated.data,
    };
    io.to(`user:${recipientId}`).emit('notification:new', {
      notification: formattedNotification,
      unreadCount,
    });
  }

  return updated;
}
// async function notifyUser(io, { type, role, recipientId, actorUserId = null, title, body, fields = {} }) {
//   // 1. Create notification row
//   const notification = await prisma.notification.create({
//     data: { type, role, recipientId, actorUserId, title, body, data: {} },
//   });

//   const payload = {
//     type,
//     role,
//     recipientId: String(recipientId),
//     ...(actorUserId != null ? { actorUserId: String(actorUserId) } : {}),
//     title,
//     body,
//     ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])),
//     notificationId: String(notification.id),
//   };

//   // 2. Attach updated data payload
//   const updated = await prisma.notification.update({
//     where: { id: notification.id },
//     data: { data: payload },
//     include: { actor: { select: ACTOR_SELECT } },
//   });

//   // 3. Send Push Notification async
//   sendPushNotification(payload).catch((err) =>
//     console.error(`Failed to send ${type} push to user ${recipientId}:`, err)
//   );

//   // 4. Calculate total unread count for recipient
//   const { count: unreadCount } = await notificationService.unreadCount(recipientId);

//   // 5. Emit 'notification:new' event over Socket.io
//   if (io) {
//     const formattedNotification = {
//       id: updated.id,
//       read: updated.read,
//       createdAt: updated.createdAt,
//       actor: formatActor(updated.actor),
//       data: updated.data,
//     };

//     io.to(`user:${recipientId}`).emit('notification:new', {
//       notification: formattedNotification,
//       unreadCount,
//     });
//   }

//   return updated;
// }

const notificationService = {
  notifyUser,

  async notifyFollow(io, followerId, followedId) {
    const [follower, followed] = await Promise.all([
      prisma.user.findUnique({ where: { id: followerId }, select: { role: true } }),
      prisma.user.findUnique({ where: { id: followedId }, select: { role: true } }),
    ]);
    if (!followed) return null;

    const roleLabel =
      follower?.role === 'SCOUT' ? 'A scout' : follower?.role === 'PLAYER' ? 'A player' : 'Someone';

    return notifyUser(io, {
      type: PushNotificationType.FOLLOW,
      role: followed.role,
      recipientId: followedId,
      actorUserId: followerId,
      title: 'New follower',
      body: `${roleLabel} started following you`,
    });
  },

  async notifyNewReel(io, reelId) {
    const reel = await prisma.reel.findUnique({
      where: { id: reelId },
      select: {
        id: true,
        durationSec: true,
        createdAt: true,
        playerId: true,
        player: { select: { id: true, fullname: true } },
        category: { select: { title: true } },
      },
    });
    if (!reel || !reel.player) return;

    const followers = await prisma.follower.findMany({
      where: { followedId: reel.playerId },
      select: { follower: { select: { id: true, role: true } } },
    });
    if (followers.length === 0) return;

    const title = `${reel.player.fullname} posted a new reel`;
    const durationLabel = formatDuration(reel.durationSec);
    const body = reel.category?.title ? `${reel.category.title} · ${durationLabel}` : durationLabel;

    // Each notifyUser does several DB queries + a push. Firing one per
    // follower at once can exhaust the Prisma pool for popular players,
    // so work through them in small batches.
    const BATCH = 25;
    for (let i = 0; i < followers.length; i += BATCH) {
      await Promise.allSettled(
        followers.slice(i, i + BATCH).map(({ follower }) =>
          notifyUser(io, {
            type: PushNotificationType.POST,
            role: follower.role,
            recipientId: follower.id,
            actorUserId: reel.playerId,
            title,
            body,
            // Deep-link handover rule 3 (2026-09-28): reelIndex dropped —
            // the client now resolves the reel's position by reelId alone.
            fields: { reelId: reel.id, playerId: reel.playerId, actorFullname: reel.player.fullname },
          })
        )
      );
    }
  },

  // Deep-link handover COMMENT (2026-09-28): notifies the reel owner that
  // someone commented, and separately notifies anyone else who has already
  // commented on this same reel ("someone also commented on a thread
  // you're in") — the doc's open question flags this as the only sensible
  // meaning of COMMENT for a scout, since scouts don't own reels.
  async notifyComment(io, commentId) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        text: true,
        reelId: true,
        userId: true,
        user: { select: { id: true, fullname: true } },
        reel: {
          select: {
            id: true,
            playerId: true,
            player: { select: { id: true, role: true } },
          },
        },
      },
    });
    // Only reel comments carry a playerId/reelId for this contract — a
    // post/video comment has nowhere in this spec to route to.
    if (!comment || !comment.reel) return;

    const { reel } = comment;

    // Distinct prior commenters on this reel, excluding the actor and the
    // reel owner (the owner is handled separately below so they're never
    // silently skipped just because they also happen to have commented).
    const priorCommenters = await prisma.comment.findMany({
      where: {
        reelId: comment.reelId,
        id: { not: comment.id },
        userId: { notIn: [comment.userId, reel.playerId] },
      },
      distinct: ['userId'],
      select: { user: { select: { id: true, role: true } } },
    });

    const recipients = [];
    const seen = new Set([comment.userId]); // never notify the commenter about their own comment

    if (reel.playerId !== comment.userId && reel.player) {
      recipients.push({ id: reel.player.id, role: reel.player.role });
      seen.add(reel.player.id);
    }
    for (const { user } of priorCommenters) {
      if (seen.has(user.id)) continue;
      seen.add(user.id);
      recipients.push(user);
    }
    if (recipients.length === 0) return;

    const title = `${comment.user.fullname} commented`;
    const body = comment.text;

    const BATCH = 25;
    for (let i = 0; i < recipients.length; i += BATCH) {
      await Promise.allSettled(
        recipients.slice(i, i + BATCH).map((recipient) =>
          notifyUser(io, {
            type: PushNotificationType.COMMENT,
            role: recipient.role,
            recipientId: recipient.id,
            actorUserId: comment.userId,
            title,
            body,
            fields: {
              reelId: reel.id,
              playerId: reel.playerId,
              commentId: comment.id,
              actorFullname: comment.user.fullname,
            },
          })
        )
      );
    }
  },

  // Deep-link handover REPLY (2026-09-28): notifies the parent comment's
  // author that someone replied to it. `rawBody` must be the reply text
  // BEFORE any @mention merge (replyService.addReply prepends
  // mentionedUser into the stored text) — rule 4 says the notification
  // body must not repeat the recipient's own name back to them.
  async notifyReply(io, replyId, rawBody) {
    const reply = await prisma.reply.findUnique({
      where: { id: replyId },
      select: {
        id: true,
        userId: true,
        user: { select: { id: true, fullname: true } },
        comment: {
          select: {
            id: true,
            userId: true,
            reelId: true,
            user: { select: { id: true, role: true } },
            reel: { select: { id: true, playerId: true } },
          },
        },
      },
    });
    if (!reply || !reply.comment || !reply.comment.reel) return;

    // Rule 5: do not notify the actor (replying to your own comment).
    if (reply.userId === reply.comment.userId) return;

    const { comment } = reply;

    return notifyUser(io, {
      type: PushNotificationType.REPLY,
      role: comment.user.role,
      recipientId: comment.userId,
      actorUserId: reply.userId,
      title: `${reply.user.fullname} replied to your comment`,
      body: rawBody,
      fields: {
        // Rule 1: commentId is the PARENT comment's id, never the reply's
        // own id — the new reply's id goes in replyId.
        reelId: comment.reel.id,
        playerId: comment.reel.playerId,
        commentId: comment.id,
        replyId: reply.id,
        actorFullname: reply.user.fullname,
      },
    });
  },

  async list(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { actor: { select: ACTOR_SELECT } },
      }),
      prisma.notification.count({ where: { recipientId: userId } }),
    ]);

    return {
      data: rows.map((n) => ({
        id: n.id,
        read: n.read,
        createdAt: n.createdAt,
        actor: formatActor(n.actor),
        data: n.data,
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  },

  async unreadCount(userId) {
    const count = await prisma.notification.count({ where: { recipientId: userId, read: false } });
    return { count };
  },

  async markRead(io, userId, notificationId) {
    await prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { read: true },
    });

    const { count: unreadCount } = await notificationService.unreadCount(userId);

    // Emit 'notification:read' event
    if (io) {
      io.to(`user:${userId}`).emit('notification:read', {
        id: notificationId,
        unreadCount,
      });
    }
  },

  async markAllRead(io, userId) {
    await prisma.notification.updateMany({
      where: { recipientId: userId, read: false },
      data: { read: true },
    });

    // Emit 'notification:read-all' event
    if (io) {
      io.to(`user:${userId}`).emit('notification:read-all', {
        unreadCount: 0,
      });
    }
  },

  // DELETE /notifications/:id — scoped to recipientId, same pattern as
  // markRead, so a user can't delete someone else's notification.
  // deleteMany is a safe no-op if the id doesn't belong to them or is
  // already gone, so this is safe to call more than once.
  async remove(io, userId, notificationId) {
    const { count } = await prisma.notification.deleteMany({
      where: { id: notificationId, recipientId: userId },
    });

    if (count === 0) {
      const error = new Error('Notification not found');
      error.statusCode = 404;
      throw error;
    }

    const { count: unreadCount } = await notificationService.unreadCount(userId);

    if (io) {
      io.to(`user:${userId}`).emit('notification:deleted', {
        id: notificationId,
        unreadCount,
      });
    }
  },
};

export default notificationService;



// import prisma from '../lib/prisma.js';
// import { sendPushNotification, PushNotificationType } from './pushNotificationService.js';

// const ACTOR_SELECT = {
//   id: true,
//   fullname: true,
//   role: true,
//   profile: { select: { avatarUrl: true } },
//   scoutProfile: { select: { avatarUrl: true } },
// };

// function formatActor(user) {
//   if (!user) return null;
//   return {
//     id: user.id,
//     fullname: user.fullname,
//     role: user.role,
//     avatarUrl: user.profile?.avatarUrl ?? user.scoutProfile?.avatarUrl ?? null,
//   };
// }

// function formatDuration(seconds) {
//   if (seconds == null || Number.isNaN(seconds)) return '';
//   const s = Math.max(Math.round(seconds), 0);
//   return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
// }

// /**
//  * Enhanced notifyUser emitting real-time socket events
//  */
// async function notifyUser(io, { type, role, recipientId, actorUserId = null, title, body, fields = {} }) {
//   let notification;
//   try {
//     notification = await prisma.notification.create({
//       data: { type, role, recipientId, actorUserId, title, body, data: {} },
//     });
//   } catch (err) {
//     console.error(
//       `notifyUser create failed — type=${type} role=${role} recipientId=${recipientId} actorUserId=${actorUserId}`,
//       err.code, err.message, err.meta
//     );
//     throw err;
//   }

//   const payload = {
//     type,
//     role,
//     recipientId: String(recipientId),
//     ...(actorUserId != null ? { actorUserId: String(actorUserId) } : {}),
//     title,
//     body,
//     ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])),
//     notificationId: String(notification.id),
//   };

//   const updated = await prisma.notification.update({
//     where: { id: notification.id },
//     data: { data: payload },
//     include: { actor: { select: ACTOR_SELECT } },
//   });

//   sendPushNotification(payload).catch((err) =>
//     console.error(`Failed to send ${type} push to user ${recipientId}:`, err)
//   );

//   const { count: unreadCount } = await notificationService.unreadCount(recipientId);

//   if (io) {
//     const formattedNotification = {
//       id: updated.id,
//       read: updated.read,
//       createdAt: updated.createdAt,
//       actor: formatActor(updated.actor),
//       data: updated.data,
//     };
//     io.to(`user:${recipientId}`).emit('notification:new', {
//       notification: formattedNotification,
//       unreadCount,
//     });
//   }

//   return updated;
// }
// // async function notifyUser(io, { type, role, recipientId, actorUserId = null, title, body, fields = {} }) {
// //   // 1. Create notification row
// //   const notification = await prisma.notification.create({
// //     data: { type, role, recipientId, actorUserId, title, body, data: {} },
// //   });

// //   const payload = {
// //     type,
// //     role,
// //     recipientId: String(recipientId),
// //     ...(actorUserId != null ? { actorUserId: String(actorUserId) } : {}),
// //     title,
// //     body,
// //     ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])),
// //     notificationId: String(notification.id),
// //   };

// //   // 2. Attach updated data payload
// //   const updated = await prisma.notification.update({
// //     where: { id: notification.id },
// //     data: { data: payload },
// //     include: { actor: { select: ACTOR_SELECT } },
// //   });

// //   // 3. Send Push Notification async
// //   sendPushNotification(payload).catch((err) =>
// //     console.error(`Failed to send ${type} push to user ${recipientId}:`, err)
// //   );

// //   // 4. Calculate total unread count for recipient
// //   const { count: unreadCount } = await notificationService.unreadCount(recipientId);

// //   // 5. Emit 'notification:new' event over Socket.io
// //   if (io) {
// //     const formattedNotification = {
// //       id: updated.id,
// //       read: updated.read,
// //       createdAt: updated.createdAt,
// //       actor: formatActor(updated.actor),
// //       data: updated.data,
// //     };

// //     io.to(`user:${recipientId}`).emit('notification:new', {
// //       notification: formattedNotification,
// //       unreadCount,
// //     });
// //   }

// //   return updated;
// // }

// const notificationService = {
//   notifyUser,

//   async notifyFollow(io, followerId, followedId) {
//     const [follower, followed] = await Promise.all([
//       prisma.user.findUnique({ where: { id: followerId }, select: { role: true } }),
//       prisma.user.findUnique({ where: { id: followedId }, select: { role: true } }),
//     ]);
//     if (!followed) return null;

//     const roleLabel =
//       follower?.role === 'SCOUT' ? 'A scout' : follower?.role === 'PLAYER' ? 'A player' : 'Someone';

//     return notifyUser(io, {
//       type: PushNotificationType.FOLLOW,
//       role: followed.role,
//       recipientId: followedId,
//       actorUserId: followerId,
//       title: 'New follower',
//       body: `${roleLabel} started following you`,
//     });
//   },

//   async notifyNewReel(io, reelId) {
//     const reel = await prisma.reel.findUnique({
//       where: { id: reelId },
//       select: {
//         id: true,
//         durationSec: true,
//         createdAt: true,
//         playerId: true,
//         player: { select: { id: true, fullname: true } },
//         category: { select: { title: true } },
//       },
//     });
//     if (!reel || !reel.player) return;

//     const followers = await prisma.follower.findMany({
//       where: { followedId: reel.playerId },
//       select: { follower: { select: { id: true, role: true } } },
//     });
//     if (followers.length === 0) return;

//     const publishedCountUpToThis = await prisma.reel.count({
//       where: { playerId: reel.playerId, published: true, createdAt: { lte: reel.createdAt } },
//     });
//     const reelIndex = Math.max(publishedCountUpToThis - 1, 0);

//     const title = `${reel.player.fullname} posted a new reel`;
//     const durationLabel = formatDuration(reel.durationSec);
//     const body = reel.category?.title ? `${reel.category.title} · ${durationLabel}` : durationLabel;

//     // Each notifyUser does several DB queries + a push. Firing one per
//     // follower at once can exhaust the Prisma pool for popular players,
//     // so work through them in small batches.
//     const BATCH = 25;
//     for (let i = 0; i < followers.length; i += BATCH) {
//       await Promise.allSettled(
//         followers.slice(i, i + BATCH).map(({ follower }) =>
//           notifyUser(io, {
//             type: PushNotificationType.POST,
//             role: follower.role,
//             recipientId: follower.id,
//             actorUserId: reel.playerId,
//             title,
//             body,
//             fields: { reelId: reel.id, playerId: reel.playerId, reelIndex },
//           })
//         )
//       );
//     }
//   },

//   async list(userId, { page = 1, limit = 20 } = {}) {
//     const skip = (page - 1) * limit;
//     const [rows, total] = await Promise.all([
//       prisma.notification.findMany({
//         where: { recipientId: userId },
//         orderBy: { createdAt: 'desc' },
//         skip,
//         take: limit,
//         include: { actor: { select: ACTOR_SELECT } },
//       }),
//       prisma.notification.count({ where: { recipientId: userId } }),
//     ]);

//     return {
//       data: rows.map((n) => ({
//         id: n.id,
//         read: n.read,
//         createdAt: n.createdAt,
//         actor: formatActor(n.actor),
//         data: n.data,
//       })),
//       pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
//     };
//   },

//   async unreadCount(userId) {
//     const count = await prisma.notification.count({ where: { recipientId: userId, read: false } });
//     return { count };
//   },

//   async markRead(io, userId, notificationId) {
//     await prisma.notification.updateMany({
//       where: { id: notificationId, recipientId: userId },
//       data: { read: true },
//     });

//     const { count: unreadCount } = await notificationService.unreadCount(userId);

//     // Emit 'notification:read' event
//     if (io) {
//       io.to(`user:${userId}`).emit('notification:read', {
//         id: notificationId,
//         unreadCount,
//       });
//     }
//   },

//   async markAllRead(io, userId) {
//     await prisma.notification.updateMany({
//       where: { recipientId: userId, read: false },
//       data: { read: true },
//     });

//     // Emit 'notification:read-all' event
//     if (io) {
//       io.to(`user:${userId}`).emit('notification:read-all', {
//         unreadCount: 0,
//       });
//     }
//   },

//   // DELETE /notifications/:id — scoped to recipientId, same pattern as
//   // markRead, so a user can't delete someone else's notification.
//   // deleteMany is a safe no-op if the id doesn't belong to them or is
//   // already gone, so this is safe to call more than once.
//   async remove(io, userId, notificationId) {
//     const { count } = await prisma.notification.deleteMany({
//       where: { id: notificationId, recipientId: userId },
//     });

//     if (count === 0) {
//       const error = new Error('Notification not found');
//       error.statusCode = 404;
//       throw error;
//     }

//     const { count: unreadCount } = await notificationService.unreadCount(userId);

//     if (io) {
//       io.to(`user:${userId}`).emit('notification:deleted', {
//         id: notificationId,
//         unreadCount,
//       });
//     }
//   },
// };

// export default notificationService;













// import prisma from '../lib/prisma.js';
// import { sendPushNotification, PushNotificationType } from './pushNotificationService.js';

// const ACTOR_SELECT = {
//   id: true,
//   fullname: true,
//   role: true,
//   profile: { select: { avatarUrl: true } },
//   scoutProfile: { select: { avatarUrl: true } },
// };

// function formatActor(user) {
//   if (!user) return null;
//   return {
//     id: user.id,
//     fullname: user.fullname,
//     role: user.role,
//     avatarUrl: user.profile?.avatarUrl ?? user.scoutProfile?.avatarUrl ?? null,
//   };
// }

// function formatDuration(seconds) {
//   if (seconds == null || Number.isNaN(seconds)) return '';
//   const s = Math.max(Math.round(seconds), 0);
//   return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
// }

// /**
//  * Enhanced notifyUser emitting real-time socket events
//  */
// async function notifyUser(io, { type, role, recipientId, actorUserId = null, title, body, fields = {} }) {
//   let notification;
//   try {
//     notification = await prisma.notification.create({
//       data: { type, role, recipientId, actorUserId, title, body, data: {} },
//     });
//   } catch (err) {
//     console.error(
//       `notifyUser create failed — type=${type} role=${role} recipientId=${recipientId} actorUserId=${actorUserId}`,
//       err.code, err.message, err.meta
//     );
//     throw err;
//   }

//   const payload = {
//     type,
//     role,
//     recipientId: String(recipientId),
//     ...(actorUserId != null ? { actorUserId: String(actorUserId) } : {}),
//     title,
//     body,
//     ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])),
//     notificationId: String(notification.id),
//   };

//   const updated = await prisma.notification.update({
//     where: { id: notification.id },
//     data: { data: payload },
//     include: { actor: { select: ACTOR_SELECT } },
//   });

//   sendPushNotification(payload).catch((err) =>
//     console.error(`Failed to send ${type} push to user ${recipientId}:`, err)
//   );

//   const { count: unreadCount } = await notificationService.unreadCount(recipientId);

//   if (io) {
//     const formattedNotification = {
//       id: updated.id,
//       read: updated.read,
//       createdAt: updated.createdAt,
//       actor: formatActor(updated.actor),
//       data: updated.data,
//     };
//     io.to(`user:${recipientId}`).emit('notification:new', {
//       notification: formattedNotification,
//       unreadCount,
//     });
//   }

//   return updated;
// }
// // async function notifyUser(io, { type, role, recipientId, actorUserId = null, title, body, fields = {} }) {
// //   // 1. Create notification row
// //   const notification = await prisma.notification.create({
// //     data: { type, role, recipientId, actorUserId, title, body, data: {} },
// //   });

// //   const payload = {
// //     type,
// //     role,
// //     recipientId: String(recipientId),
// //     ...(actorUserId != null ? { actorUserId: String(actorUserId) } : {}),
// //     title,
// //     body,
// //     ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])),
// //     notificationId: String(notification.id),
// //   };

// //   // 2. Attach updated data payload
// //   const updated = await prisma.notification.update({
// //     where: { id: notification.id },
// //     data: { data: payload },
// //     include: { actor: { select: ACTOR_SELECT } },
// //   });

// //   // 3. Send Push Notification async
// //   sendPushNotification(payload).catch((err) =>
// //     console.error(`Failed to send ${type} push to user ${recipientId}:`, err)
// //   );

// //   // 4. Calculate total unread count for recipient
// //   const { count: unreadCount } = await notificationService.unreadCount(recipientId);

// //   // 5. Emit 'notification:new' event over Socket.io
// //   if (io) {
// //     const formattedNotification = {
// //       id: updated.id,
// //       read: updated.read,
// //       createdAt: updated.createdAt,
// //       actor: formatActor(updated.actor),
// //       data: updated.data,
// //     };

// //     io.to(`user:${recipientId}`).emit('notification:new', {
// //       notification: formattedNotification,
// //       unreadCount,
// //     });
// //   }

// //   return updated;
// // }

// const notificationService = {
//   notifyUser,

//   async notifyFollow(io, followerId, followedId) {
//     const [follower, followed] = await Promise.all([
//       prisma.user.findUnique({ where: { id: followerId }, select: { role: true } }),
//       prisma.user.findUnique({ where: { id: followedId }, select: { role: true } }),
//     ]);
//     if (!followed) return null;

//     const roleLabel =
//       follower?.role === 'SCOUT' ? 'A scout' : follower?.role === 'PLAYER' ? 'A player' : 'Someone';

//     return notifyUser(io, {
//       type: PushNotificationType.FOLLOW,
//       role: followed.role,
//       recipientId: followedId,
//       actorUserId: followerId,
//       title: 'New follower',
//       body: `${roleLabel} started following you`,
//     });
//   },

//   async notifyNewReel(io, reelId) {
//     const reel = await prisma.reel.findUnique({
//       where: { id: reelId },
//       select: {
//         id: true,
//         durationSec: true,
//         createdAt: true,
//         playerId: true,
//         player: { select: { id: true, fullname: true } },
//         category: { select: { title: true } },
//       },
//     });
//     if (!reel || !reel.player) return;

//     const followers = await prisma.follower.findMany({
//       where: { followedId: reel.playerId },
//       select: { follower: { select: { id: true, role: true } } },
//     });
//     if (followers.length === 0) return;

//     const publishedCountUpToThis = await prisma.reel.count({
//       where: { playerId: reel.playerId, published: true, createdAt: { lte: reel.createdAt } },
//     });
//     const reelIndex = Math.max(publishedCountUpToThis - 1, 0);

//     const title = `${reel.player.fullname} posted a new reel`;
//     const durationLabel = formatDuration(reel.durationSec);
//     const body = reel.category?.title ? `${reel.category.title} · ${durationLabel}` : durationLabel;

//     // Each notifyUser does several DB queries + a push. Firing one per
//     // follower at once can exhaust the Prisma pool for popular players,
//     // so work through them in small batches.
//     const BATCH = 25;
//     for (let i = 0; i < followers.length; i += BATCH) {
//       await Promise.allSettled(
//         followers.slice(i, i + BATCH).map(({ follower }) =>
//           notifyUser(io, {
//             type: PushNotificationType.POST,
//             role: follower.role,
//             recipientId: follower.id,
//             actorUserId: reel.playerId,
//             title,
//             body,
//             fields: { reelId: reel.id, playerId: reel.playerId, reelIndex },
//           })
//         )
//       );
//     }
//   },


//   async list(userId, { page = 1, limit = 20 } = {}) {
//     const skip = (page - 1) * limit;
//     const [rows, total] = await Promise.all([
//       prisma.notification.findMany({
//         where: { recipientId: userId },
//         orderBy: { createdAt: 'desc' },
//         skip,
//         take: limit,
//         include: { actor: { select: ACTOR_SELECT } },
//       }),
//       prisma.notification.count({ where: { recipientId: userId } }),
//     ]);

//     return {
//       data: rows.map((n) => ({
//         id: n.id,
//         read: n.read,
//         createdAt: n.createdAt,
//         actor: formatActor(n.actor),
//         data: n.data,
//       })),
//       pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
//     };
//   },

//   async unreadCount(userId) {
//     const count = await prisma.notification.count({ where: { recipientId: userId, read: false } });
//     return { count };
//   },

//   async markRead(io, userId, notificationId) {
//     await prisma.notification.updateMany({
//       where: { id: notificationId, recipientId: userId },
//       data: { read: true },
//     });

//     const { count: unreadCount } = await notificationService.unreadCount(userId);

//     // Emit 'notification:read' event
//     if (io) {
//       io.to(`user:${userId}`).emit('notification:read', {
//         id: notificationId,
//         unreadCount,
//       });
//     }
//   },

//   async markAllRead(io, userId) {
//     await prisma.notification.updateMany({
//       where: { recipientId: userId, read: false },
//       data: { read: true },
//     });

//     // Emit 'notification:read-all' event
//     if (io) {
//       io.to(`user:${userId}`).emit('notification:read-all', {
//         unreadCount: 0,
//       });
//     }
//   },

//   // DELETE /notifications/:id — scoped to recipientId, same pattern as
//   // markRead, so a user can't delete someone else's notification.
//   // deleteMany is a safe no-op if the id doesn't belong to them or is
//   // already gone, so this is safe to call more than once.
//   async remove(io, userId, notificationId) {
//     const { count } = await prisma.notification.deleteMany({
//       where: { id: notificationId, recipientId: userId },
//     });

//     if (count === 0) {
//       const error = new Error('Notification not found');
//       error.statusCode = 404;
//       throw error;
//     }

//     const { count: unreadCount } = await notificationService.unreadCount(userId);

//     if (io) {
//       io.to(`user:${userId}`).emit('notification:deleted', {
//         id: notificationId,
//         unreadCount,
//       });
//     }
//   },
// };

// export default notificationService;






















// // import prisma from '../lib/prisma.js';
// // import { sendPushNotification, PushNotificationType } from './pushNotificationService.js';

// // const ACTOR_SELECT = {
// //   id: true,
// //   fullname: true,
// //   role: true,
// //   profile: { select: { avatarUrl: true } },
// //   scoutProfile: { select: { avatarUrl: true } },
// // };

// // function formatActor(user) {
// //   if (!user) return null;
// //   return {
// //     id: user.id,
// //     fullname: user.fullname,
// //     role: user.role,
// //     avatarUrl: user.profile?.avatarUrl ?? user.scoutProfile?.avatarUrl ?? null,
// //   };
// // }

// // function formatDuration(seconds) {
// //   if (seconds == null || Number.isNaN(seconds)) return '';
// //   const s = Math.max(Math.round(seconds), 0);
// //   return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
// // }

// // /**
// //  * Enhanced notifyUser emitting real-time socket events
// //  */
// // async function notifyUser(io, { type, role, recipientId, actorUserId = null, title, body, fields = {} }) {
// //   let notification;
// //   try {
// //     notification = await prisma.notification.create({
// //       data: { type, role, recipientId, actorUserId, title, body, data: {} },
// //     });
// //   } catch (err) {
// //     console.error(
// //       `notifyUser create failed — type=${type} role=${role} recipientId=${recipientId} actorUserId=${actorUserId}`,
// //       err.code, err.message, err.meta
// //     );
// //     throw err;
// //   }

// //   const payload = {
// //     type,
// //     role,
// //     recipientId: String(recipientId),
// //     ...(actorUserId != null ? { actorUserId: String(actorUserId) } : {}),
// //     title,
// //     body,
// //     ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])),
// //     notificationId: String(notification.id),
// //   };

// //   const updated = await prisma.notification.update({
// //     where: { id: notification.id },
// //     data: { data: payload },
// //     include: { actor: { select: ACTOR_SELECT } },
// //   });

// //   sendPushNotification(payload).catch((err) =>
// //     console.error(`Failed to send ${type} push to user ${recipientId}:`, err)
// //   );

// //   const { count: unreadCount } = await notificationService.unreadCount(recipientId);

// //   if (io) {
// //     const formattedNotification = {
// //       id: updated.id,
// //       read: updated.read,
// //       createdAt: updated.createdAt,
// //       actor: formatActor(updated.actor),
// //       data: updated.data,
// //     };
// //     io.to(`user:${recipientId}`).emit('notification:new', {
// //       notification: formattedNotification,
// //       unreadCount,
// //     });
// //   }

// //   return updated;
// // }
// // // async function notifyUser(io, { type, role, recipientId, actorUserId = null, title, body, fields = {} }) {
// // //   // 1. Create notification row
// // //   const notification = await prisma.notification.create({
// // //     data: { type, role, recipientId, actorUserId, title, body, data: {} },
// // //   });

// // //   const payload = {
// // //     type,
// // //     role,
// // //     recipientId: String(recipientId),
// // //     ...(actorUserId != null ? { actorUserId: String(actorUserId) } : {}),
// // //     title,
// // //     body,
// // //     ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])),
// // //     notificationId: String(notification.id),
// // //   };

// // //   // 2. Attach updated data payload
// // //   const updated = await prisma.notification.update({
// // //     where: { id: notification.id },
// // //     data: { data: payload },
// // //     include: { actor: { select: ACTOR_SELECT } },
// // //   });

// // //   // 3. Send Push Notification async
// // //   sendPushNotification(payload).catch((err) =>
// // //     console.error(`Failed to send ${type} push to user ${recipientId}:`, err)
// // //   );

// // //   // 4. Calculate total unread count for recipient
// // //   const { count: unreadCount } = await notificationService.unreadCount(recipientId);

// // //   // 5. Emit 'notification:new' event over Socket.io
// // //   if (io) {
// // //     const formattedNotification = {
// // //       id: updated.id,
// // //       read: updated.read,
// // //       createdAt: updated.createdAt,
// // //       actor: formatActor(updated.actor),
// // //       data: updated.data,
// // //     };

// // //     io.to(`user:${recipientId}`).emit('notification:new', {
// // //       notification: formattedNotification,
// // //       unreadCount,
// // //     });
// // //   }

// // //   return updated;
// // // }

// // const notificationService = {
// //   notifyUser,

// //   async notifyFollow(io, followerId, followedId) {
// //     const [follower, followed] = await Promise.all([
// //       prisma.user.findUnique({ where: { id: followerId }, select: { role: true } }),
// //       prisma.user.findUnique({ where: { id: followedId }, select: { role: true } }),
// //     ]);
// //     if (!followed) return null;

// //     const roleLabel =
// //       follower?.role === 'SCOUT' ? 'A scout' : follower?.role === 'PLAYER' ? 'A player' : 'Someone';

// //     return notifyUser(io, {
// //       type: PushNotificationType.FOLLOW,
// //       role: followed.role,
// //       recipientId: followedId,
// //       actorUserId: followerId,
// //       title: 'New follower',
// //       body: `${roleLabel} started following you`,
// //     });
// //   },

// //   async notifyNewReel(io, reelId) {
// //     const reel = await prisma.reel.findUnique({
// //       where: { id: reelId },
// //       select: {
// //         id: true,
// //         durationSec: true,
// //         createdAt: true,
// //         playerId: true,
// //         player: { select: { id: true, fullname: true } },
// //         category: { select: { title: true } },
// //       },
// //     });
// //     if (!reel || !reel.player) return;

// //     const followers = await prisma.follower.findMany({
// //       where: { followedId: reel.playerId },
// //       select: { follower: { select: { id: true, role: true } } },
// //     });
// //     if (followers.length === 0) return;

// //     const publishedCountUpToThis = await prisma.reel.count({
// //       where: { playerId: reel.playerId, published: true, createdAt: { lte: reel.createdAt } },
// //     });
// //     const reelIndex = Math.max(publishedCountUpToThis - 1, 0);

// //     const title = `${reel.player.fullname} posted a new reel`;
// //     const durationLabel = formatDuration(reel.durationSec);
// //     const body = reel.category?.title ? `${reel.category.title} · ${durationLabel}` : durationLabel;

// //     // Each notifyUser does several DB queries + a push. Firing one per
// //     // follower at once can exhaust the Prisma pool for popular players,
// //     // so work through them in small batches.
// //     const BATCH = 25;
// //     for (let i = 0; i < followers.length; i += BATCH) {
// //       await Promise.allSettled(
// //         followers.slice(i, i + BATCH).map(({ follower }) =>
// //           notifyUser(io, {
// //             type: PushNotificationType.POST,
// //             role: follower.role,
// //             recipientId: follower.id,
// //             actorUserId: reel.playerId,
// //             title,
// //             body,
// //             fields: { reelId: reel.id, playerId: reel.playerId, reelIndex },
// //           })
// //         )
// //       );
// //     }
// //   },

// //   // "Someone you follow just came online" — fired by presenceHandlers.js
// //   // when a followed user's presence flips to online. Caller (presenceHandlers)
// //   // is responsible for cooldown/debounce so this isn't spammed on every
// //   // reconnect; this function just fans the notification out once called.
// //   async notifyFollowedUserOnline(io, userId) {
// //     const user = await prisma.user.findUnique({
// //       where: { id: userId },
// //       select: { id: true, fullname: true },
// //     });
// //     if (!user) return;

// //     const followers = await prisma.follower.findMany({
// //       where: { followedId: userId },
// //       select: { follower: { select: { id: true, role: true } } },
// //     });
// //     if (followers.length === 0) return;

// //     const title = `${user.fullname} is online`;
// //     const body = 'Active now — tap to say hi';

// //     const BATCH = 25;
// //     for (let i = 0; i < followers.length; i += BATCH) {
// //       await Promise.allSettled(
// //         followers.slice(i, i + BATCH).map(({ follower }) =>
// //           notifyUser(io, {
// //             type: PushNotificationType.ONLINE,
// //             role: follower.role,
// //             recipientId: follower.id,
// //             actorUserId: userId,
// //             title,
// //             body,
// //           })
// //         )
// //       );
// //     }
// //   },

// //   async list(userId, { page = 1, limit = 20 } = {}) {
// //     const skip = (page - 1) * limit;
// //     const [rows, total] = await Promise.all([
// //       prisma.notification.findMany({
// //         where: { recipientId: userId },
// //         orderBy: { createdAt: 'desc' },
// //         skip,
// //         take: limit,
// //         include: { actor: { select: ACTOR_SELECT } },
// //       }),
// //       prisma.notification.count({ where: { recipientId: userId } }),
// //     ]);

// //     return {
// //       data: rows.map((n) => ({
// //         id: n.id,
// //         read: n.read,
// //         createdAt: n.createdAt,
// //         actor: formatActor(n.actor),
// //         data: n.data,
// //       })),
// //       pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
// //     };
// //   },

// //   async unreadCount(userId) {
// //     const count = await prisma.notification.count({ where: { recipientId: userId, read: false } });
// //     return { count };
// //   },

// //   async markRead(io, userId, notificationId) {
// //     await prisma.notification.updateMany({
// //       where: { id: notificationId, recipientId: userId },
// //       data: { read: true },
// //     });

// //     const { count: unreadCount } = await notificationService.unreadCount(userId);

// //     // Emit 'notification:read' event
// //     if (io) {
// //       io.to(`user:${userId}`).emit('notification:read', {
// //         id: notificationId,
// //         unreadCount,
// //       });
// //     }
// //   },

// //   async markAllRead(io, userId) {
// //     await prisma.notification.updateMany({
// //       where: { recipientId: userId, read: false },
// //       data: { read: true },
// //     });

// //     // Emit 'notification:read-all' event
// //     if (io) {
// //       io.to(`user:${userId}`).emit('notification:read-all', {
// //         unreadCount: 0,
// //       });
// //     }
// //   },

// //   // DELETE /notifications/:id — scoped to recipientId, same pattern as
// //   // markRead, so a user can't delete someone else's notification.
// //   // deleteMany is a safe no-op if the id doesn't belong to them or is
// //   // already gone, so this is safe to call more than once.
// //   async remove(io, userId, notificationId) {
// //     const { count } = await prisma.notification.deleteMany({
// //       where: { id: notificationId, recipientId: userId },
// //     });

// //     if (count === 0) {
// //       const error = new Error('Notification not found');
// //       error.statusCode = 404;
// //       throw error;
// //     }

// //     const { count: unreadCount } = await notificationService.unreadCount(userId);

// //     if (io) {
// //       io.to(`user:${userId}`).emit('notification:deleted', {
// //         id: notificationId,
// //         unreadCount,
// //       });
// //     }
// //   },
// // };

// // export default notificationService;
















// // import prisma from '../lib/prisma.js';
// // import { sendPushNotification, PushNotificationType } from './pushNotificationService.js';

// // const ACTOR_SELECT = {
// //   id: true,
// //   fullname: true,
// //   role: true,
// //   profile: { select: { avatarUrl: true } },
// //   scoutProfile: { select: { avatarUrl: true } },
// // };

// // function formatActor(user) {
// //   if (!user) return null;
// //   return {
// //     id: user.id,
// //     fullname: user.fullname,
// //     role: user.role,
// //     avatarUrl: user.profile?.avatarUrl ?? user.scoutProfile?.avatarUrl ?? null,
// //   };
// // }

// // function formatDuration(seconds) {
// //   if (seconds == null || Number.isNaN(seconds)) return '';
// //   const s = Math.max(Math.round(seconds), 0);
// //   return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
// // }

// // /**
// //  * Enhanced notifyUser emitting real-time socket events
// //  */
// // async function notifyUser(io, { type, role, recipientId, actorUserId = null, title, body, fields = {} }) {
// //   let notification;
// //   try {
// //     notification = await prisma.notification.create({
// //       data: { type, role, recipientId, actorUserId, title, body, data: {} },
// //     });
// //   } catch (err) {
// //     console.error(
// //       `notifyUser create failed — type=${type} role=${role} recipientId=${recipientId} actorUserId=${actorUserId}`,
// //       err.code, err.message, err.meta
// //     );
// //     throw err;
// //   }

// //   const payload = {
// //     type,
// //     role,
// //     recipientId: String(recipientId),
// //     ...(actorUserId != null ? { actorUserId: String(actorUserId) } : {}),
// //     title,
// //     body,
// //     ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])),
// //     notificationId: String(notification.id),
// //   };

// //   const updated = await prisma.notification.update({
// //     where: { id: notification.id },
// //     data: { data: payload },
// //     include: { actor: { select: ACTOR_SELECT } },
// //   });

// //   sendPushNotification(payload).catch((err) =>
// //     console.error(`Failed to send ${type} push to user ${recipientId}:`, err)
// //   );

// //   const { count: unreadCount } = await notificationService.unreadCount(recipientId);

// //   if (io) {
// //     const formattedNotification = {
// //       id: updated.id,
// //       read: updated.read,
// //       createdAt: updated.createdAt,
// //       actor: formatActor(updated.actor),
// //       data: updated.data,
// //     };
// //     io.to(`user:${recipientId}`).emit('notification:new', {
// //       notification: formattedNotification,
// //       unreadCount,
// //     });
// //   }

// //   return updated;
// // }
// // // async function notifyUser(io, { type, role, recipientId, actorUserId = null, title, body, fields = {} }) {
// // //   // 1. Create notification row
// // //   const notification = await prisma.notification.create({
// // //     data: { type, role, recipientId, actorUserId, title, body, data: {} },
// // //   });

// // //   const payload = {
// // //     type,
// // //     role,
// // //     recipientId: String(recipientId),
// // //     ...(actorUserId != null ? { actorUserId: String(actorUserId) } : {}),
// // //     title,
// // //     body,
// // //     ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])),
// // //     notificationId: String(notification.id),
// // //   };

// // //   // 2. Attach updated data payload
// // //   const updated = await prisma.notification.update({
// // //     where: { id: notification.id },
// // //     data: { data: payload },
// // //     include: { actor: { select: ACTOR_SELECT } },
// // //   });

// // //   // 3. Send Push Notification async
// // //   sendPushNotification(payload).catch((err) =>
// // //     console.error(`Failed to send ${type} push to user ${recipientId}:`, err)
// // //   );

// // //   // 4. Calculate total unread count for recipient
// // //   const { count: unreadCount } = await notificationService.unreadCount(recipientId);

// // //   // 5. Emit 'notification:new' event over Socket.io
// // //   if (io) {
// // //     const formattedNotification = {
// // //       id: updated.id,
// // //       read: updated.read,
// // //       createdAt: updated.createdAt,
// // //       actor: formatActor(updated.actor),
// // //       data: updated.data,
// // //     };

// // //     io.to(`user:${recipientId}`).emit('notification:new', {
// // //       notification: formattedNotification,
// // //       unreadCount,
// // //     });
// // //   }

// // //   return updated;
// // // }

// // const notificationService = {
// //   notifyUser,

// //   async notifyFollow(io, followerId, followedId) {
// //     const [follower, followed] = await Promise.all([
// //       prisma.user.findUnique({ where: { id: followerId }, select: { role: true } }),
// //       prisma.user.findUnique({ where: { id: followedId }, select: { role: true } }),
// //     ]);
// //     if (!followed) return null;

// //     const roleLabel =
// //       follower?.role === 'SCOUT' ? 'A scout' : follower?.role === 'PLAYER' ? 'A player' : 'Someone';

// //     return notifyUser(io, {
// //       type: PushNotificationType.FOLLOW,
// //       role: followed.role,
// //       recipientId: followedId,
// //       actorUserId: followerId,
// //       title: 'New follower',
// //       body: `${roleLabel} started following you`,
// //     });
// //   },

// //   async notifyNewReel(io, reelId) {
// //     const reel = await prisma.reel.findUnique({
// //       where: { id: reelId },
// //       select: {
// //         id: true,
// //         durationSec: true,
// //         createdAt: true,
// //         playerId: true,
// //         player: { select: { id: true, fullname: true } },
// //         category: { select: { title: true } },
// //       },
// //     });
// //     if (!reel || !reel.player) return;

// //     const followers = await prisma.follower.findMany({
// //       where: { followedId: reel.playerId },
// //       select: { follower: { select: { id: true, role: true } } },
// //     });
// //     if (followers.length === 0) return;

// //     const publishedCountUpToThis = await prisma.reel.count({
// //       where: { playerId: reel.playerId, published: true, createdAt: { lte: reel.createdAt } },
// //     });
// //     const reelIndex = Math.max(publishedCountUpToThis - 1, 0);

// //     const title = `${reel.player.fullname} posted a new reel`;
// //     const durationLabel = formatDuration(reel.durationSec);
// //     const body = reel.category?.title ? `${reel.category.title} · ${durationLabel}` : durationLabel;

// //     // Each notifyUser does several DB queries + a push. Firing one per
// //     // follower at once can exhaust the Prisma pool for popular players,
// //     // so work through them in small batches.
// //     const BATCH = 25;
// //     for (let i = 0; i < followers.length; i += BATCH) {
// //       await Promise.allSettled(
// //         followers.slice(i, i + BATCH).map(({ follower }) =>
// //           notifyUser(io, {
// //             type: PushNotificationType.POST,
// //             role: follower.role,
// //             recipientId: follower.id,
// //             actorUserId: reel.playerId,
// //             title,
// //             body,
// //             fields: { reelId: reel.id, playerId: reel.playerId, reelIndex },
// //           })
// //         )
// //       );
// //     }
// //   },

// //   async list(userId, { page = 1, limit = 20 } = {}) {
// //     const skip = (page - 1) * limit;
// //     const [rows, total] = await Promise.all([
// //       prisma.notification.findMany({
// //         where: { recipientId: userId },
// //         orderBy: { createdAt: 'desc' },
// //         skip,
// //         take: limit,
// //         include: { actor: { select: ACTOR_SELECT } },
// //       }),
// //       prisma.notification.count({ where: { recipientId: userId } }),
// //     ]);

// //     return {
// //       data: rows.map((n) => ({
// //         id: n.id,
// //         read: n.read,
// //         createdAt: n.createdAt,
// //         actor: formatActor(n.actor),
// //         data: n.data,
// //       })),
// //       pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
// //     };
// //   },

// //   async unreadCount(userId) {
// //     const count = await prisma.notification.count({ where: { recipientId: userId, read: false } });
// //     return { count };
// //   },

// //   async markRead(io, userId, notificationId) {
// //     await prisma.notification.updateMany({
// //       where: { id: notificationId, recipientId: userId },
// //       data: { read: true },
// //     });

// //     const { count: unreadCount } = await notificationService.unreadCount(userId);

// //     // Emit 'notification:read' event
// //     if (io) {
// //       io.to(`user:${userId}`).emit('notification:read', {
// //         id: notificationId,
// //         unreadCount,
// //       });
// //     }
// //   },

// //   async markAllRead(io, userId) {
// //     await prisma.notification.updateMany({
// //       where: { recipientId: userId, read: false },
// //       data: { read: true },
// //     });

// //     // Emit 'notification:read-all' event
// //     if (io) {
// //       io.to(`user:${userId}`).emit('notification:read-all', {
// //         unreadCount: 0,
// //       });
// //     }
// //   },

// //   // DELETE /notifications/:id — scoped to recipientId, same pattern as
// //   // markRead, so a user can't delete someone else's notification.
// //   // deleteMany is a safe no-op if the id doesn't belong to them or is
// //   // already gone, so this is safe to call more than once.
// //   async remove(io, userId, notificationId) {
// //     const { count } = await prisma.notification.deleteMany({
// //       where: { id: notificationId, recipientId: userId },
// //     });

// //     if (count === 0) {
// //       const error = new Error('Notification not found');
// //       error.statusCode = 404;
// //       throw error;
// //     }

// //     const { count: unreadCount } = await notificationService.unreadCount(userId);

// //     if (io) {
// //       io.to(`user:${userId}`).emit('notification:deleted', {
// //         id: notificationId,
// //         unreadCount,
// //       });
// //     }
// //   },
// // };

// // export default notificationService;






