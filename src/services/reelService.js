// src/services/reelService.js
import prisma from '../lib/prisma.js';
import { uploadMediaToGCS } from '../config/multer.js';

// =========================================================
// 🔹 Common reel include block (no comments — lazy loaded)
// =========================================================
const REEL_WITH_REVIEWS = {
  category: {
    select: {
      id:    true,
      title: true,
    },
  },
  // comments block intentionally removed — fetched on-demand via comment icon tap
  ratings: {
    include: {
      user: {
        select: {
          id:       true,
          fullname: true,
        },
      },
    },
  },
  _count: {
    select: {
      views:    true,
      comments: true, // keep the COUNT so stats.comments still works
      ratings:  true,
    },
  },
};

// =========================================================
// 🔹 Extended include block (with full player profile)
// =========================================================
const REEL_WITH_PLAYER_AND_REVIEWS = {
  ...REEL_WITH_REVIEWS,
  player: {
    select: {
      id:       true,
      fullname: true,
      profile: {
        select: {
          avatarUrl: true,
          position:  true,
          country:   true,
          dob:       true,
        },
      },
    },
  },
};

// =========================================================
// 🔹 Compute average rating
// =========================================================
const avgRating = (ratings) =>
  ratings.length
    ? parseFloat((ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1))
    : null;

// =========================================================
// 🔹 Compute age from date of birth
// =========================================================
const computeAge = (dob) => {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

// =========================================================
// 🔹 Shape a reel into the standard response format
// =========================================================
const formatReel = (r) => ({
  ...r,
  averageRating: avgRating(r.ratings),
  category: r.category
    ? { id: r.category.id, title: r.category.title }
    : null,
  player: r.player
    ? {
        id:        r.player.id,
        fullname:  r.player.fullname,
        avatarUrl: r.player.profile?.avatarUrl ?? null,
        position:  r.player.profile?.position  ?? null,
        country:   r.player.profile?.country   ?? null,
        age:       computeAge(r.player.profile?.dob),
      }
    : null,
  stats: {
    views:    r._count.views,
    comments: r._count.comments,
    likes:    r._count.ratings,
  },
});

// =========================================================
// 🔹 Create a pending reel record before processing starts
// =========================================================
export const createPendingReel = async ({ title, description, published, categoryId, playerId }) => {
  return prisma.reel.create({
    data: {
      title,
      description:  description ?? null,
      published:    published   ?? false,
      categoryId,
      playerId,
      status:       'processing',
      videoUrl:     '',
      thumbnailUrl: null,
      durationSec:  null,
    },
  });
};

// =========================================================
// 🔹 Upload a reel for a player
// =========================================================
export const uploadReel = async (multerFile, meta, playerId) => {
  const player = await prisma.user.findUnique({
    where:  { id: playerId },
    select: { id: true, role: true },
  });

  if (!player) throw Object.assign(new Error('Player not found.'), { statusCode: 404 });
  if (player.role !== 'PLAYER') throw Object.assign(new Error('Target user is not a player.'), { statusCode: 400 });

  const category = await prisma.videoCategory.findUnique({
    where: { id: meta.categoryId },
  });

  if (!category) throw Object.assign(new Error('Category not found.'), { statusCode: 404 });

  const { url, thumbnailUrl, durationSec, sizeKB, uploadTimeMS } =
    await uploadMediaToGCS(multerFile, `reels/${playerId}`);

  console.log(`✅ Reel HLS ready [${sizeKB} KB, ${uploadTimeMS} ms]`);

  return prisma.reel.update({
    where: { id: meta.reelId },
    data: {
      videoUrl:     url,
      thumbnailUrl: thumbnailUrl ?? null,
      durationSec:  durationSec  ?? null,
      categoryId:   meta.categoryId,
      status:       'ready',
    },
  });
};

// =========================================================
// 🔹 Mark a reel as ready or failed
// =========================================================
export const updateReelStatus = async (reelId, { status, videoUrl, thumbnailUrl, durationSec }) => {
  return prisma.reel.update({
    where: { id: reelId },
    data:  { status, videoUrl, thumbnailUrl, durationSec },
  });
};

// =========================================================
// 🔹 Fetch all reels for a given player (with full player info)
// =========================================================
export const getReelsByUser = async (playerId, categoryId = null) => {
  const reels = await prisma.reel.findMany({
    where: {
      playerId,
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: REEL_WITH_PLAYER_AND_REVIEWS,
  });

  return reels.map(formatReel);
};

// =========================================================
// 🔹 Fetch a single reel by ID (with full player info)
// =========================================================
export const getReelById = async (reelId, viewerId = null, ipHash = null) => {
  try {
    await prisma.reelView.create({
      data: { reelId, userId: viewerId, ipHash },
    });
  } catch { /* duplicate view – skip */ }

  const reel = await prisma.reel.findUniqueOrThrow({
    where:   { id: reelId },
    include: REEL_WITH_PLAYER_AND_REVIEWS,
  });

  return formatReel(reel);
};

// =========================================================
// 🔹 Fetch all published reels by category (with full player info)
// =========================================================
export const getReelsByCategory = async (categoryId) => {
  const reels = await prisma.reel.findMany({
    where: {
      categoryId,
      published: true,
    },
    orderBy: { createdAt: 'desc' },
    include: REEL_WITH_PLAYER_AND_REVIEWS,
  });

  return reels.map(formatReel);
};




















// import prisma from '../lib/prisma.js';
// import { uploadMediaToGCS } from '../config/multer.js';


// // ─────────────────────────────────────────────────────────────────────────────
// // PATCH for reelService.js
// //
// // The only change needed: remove `comments` from REEL_WITH_REVIEWS.
// // Comments are now fetched lazily via GET /api/reels/:reelId/comments.
// // Everything else (ratings, views, player, category) stays as-is.
// // ─────────────────────────────────────────────────────────────────────────────

// // REPLACE your existing REEL_WITH_REVIEWS block with this:

// const REEL_WITH_REVIEWS = {
//   category: {
//     select: {
//       id:    true,
//       title: true,
//     },
//   },
//   // ✅ comments block REMOVED — fetched on-demand via comment icon tap
//   ratings: {
//     include: {
//       user: {
//         select: {
//           id:       true,
//           fullname: true,
//         },
//       },
//     },
//   },
//   _count: {
//     select: {
//       views:    true,
//       comments: true, // ✅ keep the COUNT so stats.comments still works
//       ratings:  true,
//     },
//   },
// };

// // =========================================================
// // 🔹 Extended include block (with full player profile)
// // =========================================================
// const REEL_WITH_PLAYER_AND_REVIEWS = {
//   ...REEL_WITH_REVIEWS,
//   player: {
//     select: {
//       id:       true,
//       fullname: true,
//       profile: {
//         select: {
//           avatarUrl: true,
//           position:  true,
//           country:   true,
//           dob:       true,   // ✅ correct field name from schema
//         },
//       },
//     },
//   },
// };


// // No other changes needed in reelService.js.
// // formatReel() already handles missing `comments` gracefully since it only
// // spreads `...r` — the comments key simply won't be present in the response,
// // which is exactly what we want.

// // =========================================================
// // 🔹 Compute average rating
// // =========================================================
// const avgRating = (ratings) =>
//   ratings.length
//     ? parseFloat((ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1))
//     : null;

// // =========================================================
// // 🔹 Compute age from date of birth
// // =========================================================
// const computeAge = (dob) => {
//   if (!dob) return null;
//   const today = new Date();
//   const birth = new Date(dob);
//   let age     = today.getFullYear() - birth.getFullYear();
//   const monthDiff = today.getMonth() - birth.getMonth();
//   if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
//     age--;
//   }
//   return age;
// };

// // =========================================================
// // 🔹 Shape a reel into the standard response format
// // =========================================================
// const formatReel = (r) => ({
//   ...r,
//   averageRating: avgRating(r.ratings),
//   category: r.category
//     ? {
//         id:    r.category.id,
//         title: r.category.title,
//       }
//     : null,
//   player: r.player
//     ? {
//         id:        r.player.id,
//         fullname:  r.player.fullname,
//         avatarUrl: r.player.profile?.avatarUrl ?? null,
//         position:  r.player.profile?.position  ?? null,
//         country:   r.player.profile?.country   ?? null,
//         age:       computeAge(r.player.profile?.dob),  // ✅ correct field name
//       }
//     : null,
//   stats: {
//     views:    r._count.views,
//     comments: r._count.comments,
//     likes:    r._count.ratings,
//   },
// });

// // =========================================================
// // 🔹 Create a pending reel record before processing starts
// // =========================================================
// export const createPendingReel = async ({ title, description, published, categoryId, playerId }) => {
//   return prisma.reel.create({
//     data: {
//       title,
//       description:  description ?? null,
//       published:    published   ?? false,
//       categoryId,
//       playerId,
//       status:       'processing',
//       videoUrl:     '',
//       thumbnailUrl: null,
//       durationSec:  null,
//     },
//   });
// };

// // =========================================================
// // 🔹 Upload a reel for a player
// // =========================================================
// export const uploadReel = async (multerFile, meta, playerId) => {
//   const player = await prisma.user.findUnique({
//     where:  { id: playerId },
//     select: { id: true, role: true },
//   });

//   if (!player) throw Object.assign(new Error('Player not found.'), { statusCode: 404 });
//   if (player.role !== 'PLAYER') throw Object.assign(new Error('Target user is not a player.'), { statusCode: 400 });

//   const category = await prisma.videoCategory.findUnique({
//     where: { id: meta.categoryId },
//   });

//   if (!category) throw Object.assign(new Error('Category not found.'), { statusCode: 404 });

//   const { url, thumbnailUrl, durationSec, sizeKB, uploadTimeMS } =
//     await uploadMediaToGCS(multerFile, `reels/${playerId}`);

//   console.log(`✅ Reel HLS ready [${sizeKB} KB, ${uploadTimeMS} ms]`);

//   return prisma.reel.update({
//     where: { id: meta.reelId },
//     data: {
//       videoUrl:     url,
//       thumbnailUrl: thumbnailUrl ?? null,
//       durationSec:  durationSec  ?? null,
//       categoryId:   meta.categoryId,
//       status:       'ready',
//     },
//   });
// };

// // =========================================================
// // 🔹 Mark a reel as ready or failed
// // =========================================================
// export const updateReelStatus = async (reelId, { status, videoUrl, thumbnailUrl, durationSec }) => {
//   return prisma.reel.update({
//     where: { id: reelId },
//     data:  { status, videoUrl, thumbnailUrl, durationSec },
//   });
// };

// // =========================================================
// // 🔹 Fetch all reels for a given player (with full player info)
// // =========================================================
// export const getReelsByUser = async (playerId, categoryId = null) => {
//   const reels = await prisma.reel.findMany({
//     where: {
//       playerId,
//       ...(categoryId ? { categoryId } : {}),
//     },
//     orderBy: { createdAt: 'desc' },
//     include: REEL_WITH_PLAYER_AND_REVIEWS,
//   });

//   return reels.map(formatReel);
// };

// // =========================================================
// // 🔹 Fetch a single reel by ID (with full player info)
// // =========================================================
// export const getReelById = async (reelId, viewerId = null, ipHash = null) => {
//   try {
//     await prisma.reelView.create({
//       data: { reelId, userId: viewerId, ipHash },
//     });
//   } catch { /* duplicate view – skip */ }

//   const reel = await prisma.reel.findUniqueOrThrow({
//     where:   { id: reelId },
//     include: REEL_WITH_PLAYER_AND_REVIEWS,
//   });

//   return formatReel(reel);
// };

// // =========================================================
// // 🔹 Fetch all published reels by category (with full player info)
// // =========================================================
// export const getReelsByCategory = async (categoryId) => {
//   const reels = await prisma.reel.findMany({
//     where: {
//       categoryId,
//       published: true,
//     },
//     orderBy: { createdAt: 'desc' },
//     include: REEL_WITH_PLAYER_AND_REVIEWS,
//   });

//   return reels.map(formatReel);
// },


// // ─── Reel-specific comment methods (lazy-loaded) ─────────────────────────────

//   /**
//    * Fetch paginated TOP-LEVEL comments for a reel.
//    * Triggered when user taps the comment icon on a reel.
//    * Replies are NOT fetched — only their count is returned per comment.
//    */
//   export const getReelComments = async(reelId, { page = 1, limit = 20 } = {}) => {
//     const skip = (page - 1) * limit;

//     const [comments, total] = await Promise.all([
//       prisma.comment.findMany({
//         where:   { reelId: Number(reelId) },
//         orderBy: { createdAt: 'desc' },
//         skip,
//         take:    limit,
//         select:  COMMENT_SELECT,
//       }),
//       prisma.comment.count({ where: { reelId: Number(reelId) } }),
//     ]);

//     return {
//       comments,
//       pagination: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit),
//       },
//     };
//   };

//   /**
//    * Post a new top-level comment on a reel.
//    */
//   export const addReelComment = async (reelId, userId, text) => {
//     // Verify the reel exists first
//     const reel = await prisma.reel.findUnique({
//       where:  { id: Number(reelId) },
//       select: { id: true },
//     });
//     if (!reel) throw { status: 404, message: 'Reel not found' };

//     return prisma.comment.create({
//       data: {
//         text,
//         reelId: Number(reelId),
//         userId: Number(userId),
//       },
//       select: COMMENT_SELECT,
//     });
//   },

//   /**
//    * Delete a comment (only by owner). Cascades to all replies via DB.
//    */
//   export const deleteReelComment = async (commentId, userId) =>  {
//     const comment = await prisma.comment.findUnique({
//       where:  { id: Number(commentId) },
//       select: { userId: true, reelId: true },
//     });

//     if (!comment) throw { status: 404, message: 'Comment not found' };
//     if (comment.userId !== Number(userId)) {
//       throw { status: 403, message: 'Not authorized to delete this comment' };
//     }

//     await prisma.comment.delete({ where: { id: Number(commentId) } });
//     return { message: 'Comment deleted successfully' };
//   },















