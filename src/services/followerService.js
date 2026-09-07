import prisma from '../lib/prisma.js';
import notificationService from './Notificationservice.js';

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
        // Foreign key violation — followedId doesn't reference a real user.
        const notFound = new Error('User to follow not found');
        notFound.statusCode = 404;
        throw notFound;
      } else {
        throw err;
      }
    }

    const { followers: followersCount } = await this.getFollowCounts(followedId);

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

    const { followers: followersCount } = await this.getFollowCounts(followedId);
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











// import prisma from '../lib/prisma.js';
// // import notificationService from './notificationService.js';
// // ^ wire this in once you share the file — see the `follow()` comment below.

// // Never `include: { user: true }` a raw User row into an API response —
// // User carries password, otp, otpExpiry, and pushToken. Select only what
// // the follower/following list actually needs, per plan section 4's
// // example response (id, fullname, role, avatarUrl, position).
// const USER_SUMMARY_SELECT = {
//   id: true,
//   fullname: true,
//   role: true,
//   profile: { select: { avatarUrl: true, position: true } },
//   scoutProfile: { select: { avatarUrl: true } },
// };

// // Profile (players) has avatarUrl + position; ScoutProfile (scouts) has
// // avatarUrl only. Flatten whichever one exists into the top-level shape
// // the plan expects, and drop the nested objects.
// function formatUserSummary(user) {
//   if (!user) return null;
//   const { profile, scoutProfile, ...rest } = user;
//   return {
//     ...rest,
//     avatarUrl: profile?.avatarUrl ?? scoutProfile?.avatarUrl ?? null,
//     position: profile?.position ?? null,
//   };
// }

// const followerService = {
//   /**
//    * Whether followerId currently follows followedId.
//    */
//   async isFollowing(followerId, followedId) {
//     if (!followerId) return false;
//     const existing = await prisma.follower.findUnique({
//       where: { followerId_followedId: { followerId, followedId } },
//     });
//     return !!existing;
//   },

//   /**
//    * Split counts per plan section 5 — keeps scout interest separate from
//    * total followers so it stays usable as a quality signal once
//    * player -> player follows exist too.
//    */
//   async getFollowCounts(userId) {
//     const [followers, scoutFollowers, following] = await Promise.all([
//       prisma.follower.count({ where: { followedId: userId } }),
//       prisma.follower.count({
//         where: { followedId: userId, follower: { role: 'SCOUT' } },
//       }),
//       prisma.follower.count({ where: { followerId: userId } }),
//     ]);
//     return { followers, scoutFollowers, following };
//   },

//   /**
//    * Idempotent follow: returns 200-shaped data whether or not the
//    * relationship already existed (plan section 4 rule: never 409).
//    */
//   async follow(followerId, followedId) {
//     if (followerId === followedId) {
//       const error = new Error('User cannot follow themselves');
//       error.statusCode = 400;
//       throw error;
//     }

//     // Attempt the create directly instead of check-then-create: reading
//     // first and creating second isn't atomic, so two near-simultaneous
//     // requests (a genuine client retry, or a double-tap) can both pass
//     // the read and then race on the write. Catching the specific Prisma
//     // error codes here makes both outcomes — "already following" and
//     // "target user doesn't exist" — resolve to the right response
//     // instead of a generic 500.
//     let justCreated = true;
//     try {
//       await prisma.follower.create({ data: { followerId, followedId } });
//     } catch (err) {
//       if (err.code === 'P2002') {
//         // Unique constraint hit — relationship already exists. Per plan
//         // section 4, this is not an error: follow is idempotent.
//         justCreated = false;
//       } else if (err.code === 'P2003') {
//         // Foreign key violation — followedId doesn't reference a real user.
//         const notFound = new Error('User to follow not found');
//         notFound.statusCode = 404;
//         throw notFound;
//       } else {
//         throw err;
//       }
//     }

//     const { followers: followersCount } = await this.getFollowCounts(followedId);

//     if (justCreated) {
//       // Kind 1 notification from plan section 6 — "Someone followed you".
//       // Fire-and-forget so a slow push send never blocks the follow response.
//       // notificationService
//       //   .send({
//       //     type: 'FOLLOW',
//       //     role: /* followed user's role, e.g. 'PLAYER' */,
//       //     recipientId: String(followedId),
//       //     actorUserId: String(followerId),
//       //     title: 'New follower',
//       //     body: 'A scout started following you',
//       //   })
//       //   .catch((err) => console.error('Failed to send follow notification', err));
//     }

//     return { following: true, followersCount };
//   },

//   /**
//    * Idempotent unfollow — deleteMany never throws if the row is already gone.
//    */
//   async unfollow(followerId, followedId) {
//     await prisma.follower.deleteMany({ where: { followerId, followedId } });

//     const { followers: followersCount } = await this.getFollowCounts(followedId);
//     return { following: false, followersCount };
//   },

//   /**
//    * People who follow userId. Each row carries viewerActions.isFollowing
//    * so the list can render Follow buttons without a request per row.
//    */
//   async getFollowers(userId, { viewerId, page = 1, limit = 20 }) {
//     const skip = (page - 1) * limit;

//     const [rows, total] = await Promise.all([
//       prisma.follower.findMany({
//         where: { followedId: userId },
//         include: { follower: { select: USER_SUMMARY_SELECT } },
//         orderBy: { followedAt: 'desc' },
//         skip,
//         take: limit,
//       }),
//       prisma.follower.count({ where: { followedId: userId } }),
//     ]);

//     const candidateIds = rows.map((r) => r.followerId);
//     const viewerFollowingSet = await this._viewerFollowingSet(viewerId, candidateIds);

//     return {
//       data: rows.map((r) => ({
//         ...formatUserSummary(r.follower),
//         viewerActions: { isFollowing: viewerFollowingSet.has(r.follower.id) },
//       })),
//       pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
//     };
//   },

//   /**
//    * People userId follows.
//    */
//   async getFollowing(userId, { viewerId, page = 1, limit = 20 }) {
//     const skip = (page - 1) * limit;

//     const [rows, total] = await Promise.all([
//       prisma.follower.findMany({
//         where: { followerId: userId },
//         include: { followed: { select: USER_SUMMARY_SELECT } },
//         orderBy: { followedAt: 'desc' },
//         skip,
//         take: limit,
//       }),
//       prisma.follower.count({ where: { followerId: userId } }),
//     ]);

//     const candidateIds = rows.map((r) => r.followedId);
//     const viewerFollowingSet = await this._viewerFollowingSet(viewerId, candidateIds);

//     return {
//       data: rows.map((r) => ({
//         ...formatUserSummary(r.followed),
//         viewerActions: { isFollowing: viewerFollowingSet.has(r.followed.id) },
//       })),
//       pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
//     };
//   },

//   /**
//    * Internal helper: which of `candidateIds` does viewerId already follow.
//    */
//   async _viewerFollowingSet(viewerId, candidateIds) {
//     if (!viewerId || candidateIds.length === 0) return new Set();
//     const rows = await prisma.follower.findMany({
//       where: { followerId: viewerId, followedId: { in: candidateIds } },
//       select: { followedId: true },
//     });
//     return new Set(rows.map((r) => r.followedId));
//   },
// };

// export default followerService;
















// // import prisma from '../lib/prisma.js';

// // const followerService = {

// //   async getAll() {
// //     return prisma.follower.findMany({
// //       include: {
// //         follower: true,
// //         followed: true,
// //       },
// //     });
// //   },

// //   async getById(id) {
// //     const follower = await prisma.follower.findUnique({
// //       where: { id },
// //       include: {
// //         follower: true,
// //         followed: true,
// //       },
// //     });

// //     if (!follower) {
// //       const error = new Error('Follower not found');
// //       error.statusCode = 404;
// //       throw error;
// //     }

// //     return follower;
// //   },

// //   async create({ followerId, followedId }) {
// //     return prisma.follower.create({
// //       data: { followerId, followedId },
// //       include: {
// //         follower: true,
// //         followed: true,
// //       },
// //     });
// //   },

// //   async update(id, { followedId }) {
// //     return prisma.follower.update({
// //       where: { id },
// //       data: { followedId },
// //       include: {
// //         follower: true,
// //         followed: true,
// //       },
// //     });
// //   },

// //   async delete(id) {
// //     return prisma.follower.delete({ where: { id } });
// //   }
// // };

// // export default followerService;