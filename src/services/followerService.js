import prisma from '../lib/prisma.js';
import notificationService from './notificationService.js';

// Never `include: { user: true }` a raw User row into an API response —
// User carries password, otp, otpExpiry, and pushToken. Select only what
// the follower/following list actually needs, per plan section 4's
// example response (id, fullname, role, avatarUrl, position).
const USER_SUMMARY_SELECT = {
  id: true,
  fullname: true,
  role: true,
  profile: { select: { avatarUrl: true, position: true } },
  scoutProfile: { select: { avatarUrl: true } },
};

// Profile (players) has avatarUrl + position; ScoutProfile (scouts) has
// avatarUrl only. Flatten whichever one exists into the top-level shape
// the plan expects, and drop the nested objects.
function formatUserSummary(user) {
  if (!user) return null;
  const { profile, scoutProfile, ...rest } = user;
  return {
    ...rest,
    avatarUrl: profile?.avatarUrl ?? scoutProfile?.avatarUrl ?? null,
    position: profile?.position ?? null,
  };
}

const followerService = {
  /**
   * Whether followerId currently follows followedId.
   */
  async isFollowing(followerId, followedId) {
    if (!followerId) return false;
    const existing = await prisma.follower.findUnique({
      where: { followerId_followedId: { followerId, followedId } },
    });
    return !!existing;
  },

  /**
   * Lean follower count — used by follow()/unfollow(), which only need
   * this one number. getFollowCounts() below runs 3 queries for the full
   * breakdown; calling it here for one field wasted 2 queries per
   * follow/unfollow, on what's likely the highest-traffic endpoint.
   */
  async getFollowersCount(userId) {
    return prisma.follower.count({ where: { followedId: userId } });
  },

  /**
   * Split counts per plan section 5 — keeps scout interest separate from
   * total followers so it stays usable as a quality signal once
   * player -> player follows exist too.
   */
  async getFollowCounts(userId) {
    const [followers, scoutFollowers, following] = await Promise.all([
      prisma.follower.count({ where: { followedId: userId } }),
      prisma.follower.count({
        where: { followedId: userId, follower: { role: 'SCOUT' } },
      }),
      prisma.follower.count({ where: { followerId: userId } }),
    ]);
    return { followers, scoutFollowers, following };
  },

  /**
   * Idempotent follow: returns 200-shaped data whether or not the
   * relationship already existed (plan section 4 rule: never 409).
   */
  async follow(followerId, followedId) {
    if (followerId === followedId) {
      const error = new Error('User cannot follow themselves');
      error.statusCode = 400;
      throw error;
    }

    // Attempt the create directly instead of check-then-create: reading
    // first and creating second isn't atomic, so two near-simultaneous
    // requests (a genuine client retry, or a double-tap) can both pass
    // the read and then race on the write. Catching the specific Prisma
    // error codes here makes both outcomes — "already following" and
    // "target user doesn't exist" — resolve to the right response
    // instead of a generic 500.
    let justCreated = true;
    try {
      await prisma.follower.create({ data: { followerId, followedId } });
    } catch (err) {
      if (err.code === 'P2002') {
        // Unique constraint hit — relationship already exists. Per plan
        // section 4, this is not an error: follow is idempotent.
        justCreated = false;
      } else if (err.code === 'P2003') {
        // Follower has two foreign keys (followerId, followedId) — check
        // which one actually failed instead of assuming it's always the
        // target. Prisma's P2003 meta.field_name carries the constraint
        // name (e.g. "Follower_followedId_fkey" on Postgres).
        const failedField = err.meta?.field_name ?? '';
        if (failedField.includes('followedId')) {
          const notFound = new Error('User to follow not found');
          notFound.statusCode = 404;
          throw notFound;
        }
        // followerId's FK failed instead — the authenticated caller's own
        // account no longer exists (e.g. deleted mid-session). That's not
        // a "user not found" response about someone else; let it surface
        // as a genuine server error.
        throw err;
      } else {
        throw err;
      }
    }

    const followersCount = await this.getFollowersCount(followedId);

    if (justCreated) {
      // Kind 1 notification from plan section 6 — "Someone followed you".
      // Fire-and-forget so a slow push send never blocks the follow response.
      notificationService
        .notifyFollow(followerId, followedId)
        .catch((err) => console.error('Failed to send follow notification', err));
    }

    return { following: true, followersCount };
  },

  /**
   * Idempotent unfollow — deleteMany never throws if the row is already gone.
   */
  async unfollow(followerId, followedId) {
    await prisma.follower.deleteMany({ where: { followerId, followedId } });

    const followersCount = await this.getFollowersCount(followedId);
    return { following: false, followersCount };
  },

  /**
   * People who follow userId. Each row carries viewerActions.isFollowing
   * so the list can render Follow buttons without a request per row.
   */
  async getFollowers(userId, { viewerId, page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.follower.findMany({
        where: { followedId: userId },
        include: { follower: { select: USER_SUMMARY_SELECT } },
        orderBy: { followedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.follower.count({ where: { followedId: userId } }),
    ]);

    const candidateIds = rows.map((r) => r.followerId);
    const viewerFollowingSet = await this._viewerFollowingSet(viewerId, candidateIds);

    return {
      data: rows.map((r) => ({
        ...formatUserSummary(r.follower),
        viewerActions: { isFollowing: viewerFollowingSet.has(r.follower.id) },
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * People userId follows.
   */
  async getFollowing(userId, { viewerId, page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.follower.findMany({
        where: { followerId: userId },
        include: { followed: { select: USER_SUMMARY_SELECT } },
        orderBy: { followedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.follower.count({ where: { followerId: userId } }),
    ]);

    const candidateIds = rows.map((r) => r.followedId);
    const viewerFollowingSet = await this._viewerFollowingSet(viewerId, candidateIds);

    return {
      data: rows.map((r) => ({
        ...formatUserSummary(r.followed),
        viewerActions: { isFollowing: viewerFollowingSet.has(r.followed.id) },
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Internal helper: which of `candidateIds` does viewerId already follow.
   */
  async _viewerFollowingSet(viewerId, candidateIds) {
    if (!viewerId || candidateIds.length === 0) return new Set();
    const rows = await prisma.follower.findMany({
      where: { followerId: viewerId, followedId: { in: candidateIds } },
      select: { followedId: true },
    });
    return new Set(rows.map((r) => r.followedId));
  },
};

export default followerService;



