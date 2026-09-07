import prisma from '../lib/prisma.js';
import { sendPushNotification, PushNotificationType } from './pushNotificationService.js';

// Never `include: { user: true }` a raw User row — see followerService.js
// for why (password, otp, otpExpiry, pushToken). Same rule here for the
// `actor` embedded on each notification row (plan §7: "embed the actor").
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
 * Creates the notification row, then sends it as a push using the exact
 * same payload — plan §6's "push and the in-app inbox should be the same
 * event" rule. `fields` carries whatever the type needs to navigate
 * (actorUserId for FOLLOW; reelId/playerId/reelIndex for POST — plan §7's
 * routing table). Never throws on push failure — a failed push shouldn't
 * roll back a follow or a reel publish.
 */
async function notifyUser({ type, role, recipientId, actorUserId = null, title, body, fields = {} }) {
  const notification = await prisma.notification.create({
    data: { type, role, recipientId, actorUserId, title, body, data: {} },
  });

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
  });

  sendPushNotification(payload).catch((err) =>
    console.error(`Failed to send ${type} push to user ${recipientId}:`, err)
  );

  return updated;
}

const notificationService = {
  notifyUser,

  /**
   * Kind 1 — "Someone followed you" (plan §6). One-off, sent to the
   * followed user. Copy adapts to the follower's role since section 3
   * only builds scout -> player for now but this also covers whichever
   * direction ships next.
   */
  async notifyFollow(followerId, followedId) {
    const [follower, followed] = await Promise.all([
      prisma.user.findUnique({ where: { id: followerId }, select: { role: true } }),
      prisma.user.findUnique({ where: { id: followedId }, select: { role: true } }),
    ]);
    if (!followed) return null;

    const roleLabel =
      follower?.role === 'SCOUT' ? 'A scout' : follower?.role === 'PLAYER' ? 'A player' : 'Someone';

    return notifyUser({
      type: PushNotificationType.FOLLOW,
      role: followed.role,
      recipientId: followedId,
      actorUserId: followerId,
      title: 'New follower',
      body: `${roleLabel} started following you`,
    });
  },

  /**
   * Kind 2 — "Someone you follow posted something" (plan §6), fired once
   * a reel finishes processing with published: true. Fans out to every
   * follower of the player, per-device-token (plan §8 — never Firebase
   * topics for follow, since payload/role/routing differ per recipient).
   *
   * Resolves blocker 1 (plan §9) by including playerId + reelIndex in the
   * payload rather than building a single-reel screen — the plan calls
   * this the cheaper of the two options.
   *
   * Does not implement: a per-follower "notifications on" flag (open
   * question 4), a repeat-follow cooldown (open question 3), or tray
   * grouping / a daily digest (blocker 2) — the plan leaves all three as
   * open server-side decisions rather than requirements.
   */
  async notifyNewReel(reelId) {
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

    // This reel's position among the player's published reels, oldest
    // first — see pushNotificationService's POST case / plan §9 blocker 1.
    const publishedCountUpToThis = await prisma.reel.count({
      where: { playerId: reel.playerId, published: true, createdAt: { lte: reel.createdAt } },
    });
    const reelIndex = Math.max(publishedCountUpToThis - 1, 0);

    const title = `${reel.player.fullname} posted a new reel`;
    const durationLabel = formatDuration(reel.durationSec);
    const body = reel.category?.title ? `${reel.category.title} · ${durationLabel}` : durationLabel;

    await Promise.allSettled(
      followers.map(({ follower }) =>
        notifyUser({
          type: PushNotificationType.POST,
          role: follower.role,
          recipientId: follower.id,
          actorUserId: reel.playerId,
          title,
          body,
          fields: { reelId: reel.id, playerId: reel.playerId, reelIndex },
        })
      )
    );
  },

  /**
   * GET /notifications?page=&limit= (plan §7) — newest first. Each row
   * carries `data`, the same navigation payload sent as the push, so a
   * tap can route without a follow-up request.
   */
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

  // GET /notifications/unread-count — a separate endpoint per plan §7 so
  // polling for the tab badge doesn't pull the whole list.
  async unreadCount(userId) {
    const count = await prisma.notification.count({ where: { recipientId: userId, read: false } });
    return { count };
  },

  // POST /notifications/:id/read — scoped to recipientId so a user can't
  // mark someone else's notification read; updateMany is a safe no-op if
  // the id doesn't belong to them or is already read, so this is safe to
  // call more than once (plan §7 requirement).
  async markRead(userId, notificationId) {
    await prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { read: true },
    });
  },

  async markAllRead(userId) {
    await prisma.notification.updateMany({
      where: { recipientId: userId, read: false },
      data: { read: true },
    });
  },
};

export default notificationService;