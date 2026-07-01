// src/services/reelService.js
import prisma from '../lib/prisma.js';
import { uploadMediaToGCS } from '../config/multer.js';

// =========================================================
// 🔹 Common reel include block (no comments — lazy loaded)
// =========================================================
const REEL_WITH_REVIEWS = {
  category: {
    select: { id: true, title: true },
  },
  ratings: {
    include: {
      user: { select: { id: true, fullname: true } },
    },
  },
  _count: {
    select: {
      views:    true,
      comments: true,
      ratings:  true,
      likes:    true,
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
      profile: {        // ✅ fixed: was `profile`
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
// 🔹 Include block: player + reviews + full comments/likes
// =========================================================
// =========================================================
// 🔹 Include block: player + reviews + comments (with replies count) + likes
// =========================================================
const REEL_WITH_PLAYER_COMMENTS_AND_LIKES = {
  ...REEL_WITH_PLAYER_AND_REVIEWS,
  comments: {
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          fullname: true,
          profile: { select: { avatarUrl: true } },
        },
      },
      _count: { select: { replies: true } },
    },
  },
  likes: {
    orderBy: { id: 'desc' }, // ReelLike has no createdAt in your schema
    include: {
      user: {
        select: {
          id: true,
          fullname: true,
          profile: { select: { avatarUrl: true } },
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
// =========================================================
// 🔹 Shape a reel into the standard response format
// =========================================================
// =========================================================
// 🔹 Shape a reel into the standard response format
// =========================================================
const formatReel = (r) => ({
  ...r,
  averageRating: avgRating(r.ratings),
  category: r.category ? { id: r.category.id, title: r.category.title } : null,
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
  comments: r.comments
    ? r.comments.map((c) => ({
        id:         c.id,
        text:       c.text,
        createdAt:  c.createdAt,
        replyCount: c._count?.replies ?? 0,
        user: c.user
          ? {
              id:        c.user.id,
              fullname:  c.user.fullname,
              avatarUrl: c.user.profile?.avatarUrl ?? null,
            }
          : null,
      }))
    : undefined,
  likes: r.likes
    ? r.likes.map((l) => ({
        id: l.id,
        user: l.user
          ? {
              id:        l.user.id,
              fullname:  l.user.fullname,
              avatarUrl: l.user.profile?.avatarUrl ?? null,
            }
          : null,
      }))
    : undefined,
  stats: {
    views:    r._count.views,
    comments: r._count.comments,
    ratings:  r._count.ratings,
    likes:    r._count.likes,
  },
});
// const formatReel = (r) => ({
//   ...r,
//   averageRating: avgRating(r.ratings),
//   category: r.category ? { id: r.category.id, title: r.category.title } : null,
//   player: r.player
//     ? {
//         id:        r.player.id,
//         fullname:  r.player.fullname,
//         avatarUrl: r.player.profile?.avatarUrl ?? null,  // ✅ fixed: was r.player.profile
//         position:  r.player.profile?.position  ?? null,  // ✅ fixed
//         country:   r.player.profile?.country   ?? null,  // ✅ fixed
//         age:       computeAge(r.player.profile?.dob),    // ✅ fixed
//       }
//     : null,
//   stats: {
//     views:    r._count.views,
//     comments: r._count.comments,
//     ratings:  r._count.ratings,
//     likes:    r._count.likes,
//   },
// });

// =========================================================
// 🔹 Attach viewer interactions
// =========================================================
const attachViewerInteractions = async (reels, viewerId) => {
  if (!viewerId || reels.length === 0) {
    return reels.map((reel) => ({
      ...reel,
      viewerActions: {
        hasLiked:     false,
        hasCommented: false,
        hasReplied:   false,
      },
    }));
  }

  const reelIds = reels.map((r) => r.id);

  const [likes, comments, replies] = await Promise.all([

    prisma.reelLike.findMany({
      where: {
        userId: viewerId,
        reelId: { in: reelIds },
      },
      select: { reelId: true },
    }),

    prisma.comment.findMany({
      where: {
        userId: viewerId,
        reelId: { in: reelIds },
      },
      select: { reelId: true },
    }),

    prisma.reply.findMany({
      where: {
        userId: viewerId,
        comment: {
          reelId: { in: reelIds },
        },
      },
      select: {
        comment: {
          select: { reelId: true },
        },
      },
    }),

  ]);

  const liked     = new Set(likes.map((x) => x.reelId));
  const commented = new Set(comments.map((x) => x.reelId));
  const replied   = new Set(
    replies.map((x) => x.comment.reelId).filter(Boolean)
  );

  return reels.map((reel) => ({
    ...reel,
    viewerActions: {
      hasLiked:     liked.has(reel.id),
      hasCommented: commented.has(reel.id),
      hasReplied:   replied.has(reel.id),
    },
  }));
};

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
export const getReelsByUser = async (playerId, categoryId = null, viewerId = null) => {
  const reels = await prisma.reel.findMany({
    where: {
      playerId,
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: REEL_WITH_PLAYER_COMMENTS_AND_LIKES,
  });

  const formatted = reels.map(formatReel);
  return attachViewerInteractions(formatted, viewerId);
};

// =========================================================
// 🔹 Fetch a single reel by ID (with full player info)
// =========================================================
export const getReelById = async (reelId, viewerId = null, ipHash = null) => {
  await recordReelView(reelId, viewerId, ipHash).catch(() => {});

  const reel = await prisma.reel.findUniqueOrThrow({
    where:   { id: reelId },
    include: REEL_WITH_PLAYER_AND_REVIEWS,
  });

  const [result] = await attachViewerInteractions([formatReel(reel)], viewerId);
  return result;
};
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

//   const [result] = await attachViewerInteractions([formatReel(reel)], viewerId);
//   return result;
// };

// =========================================================
// 🔹 Fetch all published reels by category (with full player info)
// =========================================================
export const getReelsByCategory = async (categoryId, viewerId = null) => {
  const reels = await prisma.reel.findMany({
    where: {
      categoryId,
      published: true,
    },
    orderBy: { createdAt: 'desc' },
    include: REEL_WITH_PLAYER_AND_REVIEWS,
  });

  const formatted = reels.map(formatReel);
  return attachViewerInteractions(formatted, viewerId);
};

// =========================================================
// 🔹 Record a view for a reel (idempotent per logged-in user)
// =========================================================
export const recordReelView = async (reelId, viewerId = null, ipHash = null) => {
  const reel = await prisma.reel.findUnique({
    where:  { id: reelId },
    select: { id: true },
  });

  if (!reel) {
    throw Object.assign(new Error('Reel not found.'), { statusCode: 404 });
  }

  let counted = true;

  try {
    await prisma.reelView.create({
      data: { reelId, userId: viewerId, ipHash },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      // duplicate — this logged-in user already has a view on record
      counted = false;
    } else {
      throw err;
    }
  }

  const viewCount = await prisma.reel.findUnique({
    where:  { id: reelId },
    select: { _count: { select: { views: true } } },
  }).then((r) => r._count.views);

  return { counted, viewCount };
};

