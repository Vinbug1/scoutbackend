import { PrismaClient } from '@prisma/client';
import { uploadMediaToGCS } from '../config/multer.js';

const prisma = new PrismaClient();

// =========================================================
// 🔹 Common reel include block
// =========================================================
const REEL_WITH_REVIEWS = {
  category: {
    select: { id: true, title: true, categoryType: true },
  },
  comments: {
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id:      true,
          fullname: true,
          profile: { select: { avatarUrl: true } },
        },
      },
    },
  },
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
    select: { views: true, comments: true, ratings: true },
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
        categoryId:   meta.categoryId, // ✅ required, never null
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
// 🔹 Fetch all reels for a given player
// =========================================================
export const getReelsByUser = async (playerId) => {
  const reels = await prisma.reel.findMany({
    where:   { playerId },
    orderBy: { createdAt: 'desc' },
    include: REEL_WITH_REVIEWS,
  });

  return reels.map((r) => ({
    ...r,
    averageRating: avgRating(r.ratings),
  }));
};

// =========================================================
// 🔹 Fetch a single reel by ID
// =========================================================
export const getReelById = async (reelId, viewerId = null, ipHash = null) => {
  try {
    await prisma.reelView.create({
      data: { reelId, userId: viewerId, ipHash },
    });
  } catch { /* duplicate view – skip */ }

  const reel = await prisma.reel.findUniqueOrThrow({
    where:   { id: reelId },
    include: {
      player: {
        select: {
          id:       true,
          fullname: true,
          profile:  { select: { avatarUrl: true, position: true, country: true } },
        },
      },
      ...REEL_WITH_REVIEWS,
    },
  });

  return { ...reel, averageRating: avgRating(reel.ratings) };
};
















// import { PrismaClient } from '@prisma/client';
// import { uploadMediaToGCS } from '../config/multer.js';

// const prisma = new PrismaClient();

// // =========================================================
// // 🔹 Common reel include block
// // =========================================================
// const REEL_WITH_REVIEWS = {
//   category: {
//     select: { id: true, title: true, categoryType: true },
//   },
//   comments: {
//     orderBy: { createdAt: 'desc' },
//     include: {
//       user: {
//         select: {
//           id:      true,
//           fullname: true,
//           profile: { select: { avatarUrl: true } },
//         },
//       },
//     },
//   },
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
//     select: { views: true, comments: true, ratings: true },
//   },
// };

// // =========================================================
// // 🔹 Compute average rating
// // =========================================================
// const avgRating = (ratings) =>
//   ratings.length
//     ? parseFloat((ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1))
//     : null;

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
//     const player = await prisma.user.findUnique({
//       where:  { id: playerId },
//       select: { id: true, role: true },
//     });
  
//     if (!player) throw Object.assign(new Error('Player not found.'), { statusCode: 404 });
//     if (player.role !== 'PLAYER') throw Object.assign(new Error('Target user is not a player.'), { statusCode: 400 });
  
//     const category = await prisma.videoCategory.findUnique({
//       where: { id: meta.categoryId },
//     });
  
//     if (!category) throw Object.assign(new Error('Category not found.'), { statusCode: 404 });
  
//     const { url, thumbnailUrl, durationSec, sizeKB, uploadTimeMS } =
//       await uploadMediaToGCS(multerFile, `reels/${playerId}`);
  
//     console.log(`✅ Reel HLS ready [${sizeKB} KB, ${uploadTimeMS} ms]`);
  
//     return prisma.reel.update({
//       where: { id: meta.reelId },
//       data: {
//         videoUrl:     url,
//         thumbnailUrl: thumbnailUrl ?? null,
//         durationSec:  durationSec  ?? null,
//         categoryId:   meta.categoryId, // ✅ required, never null
//         status:       'ready',
//       },
//     });
//   };

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
// // 🔹 Fetch all reels for a given player
// // =========================================================
// export const getReelsByUser = async (playerId) => {
//   const reels = await prisma.reel.findMany({
//     where:   { playerId },
//     orderBy: { createdAt: 'desc' },
//     include: REEL_WITH_REVIEWS,
//   });

//   return reels.map((r) => ({
//     ...r,
//     averageRating: avgRating(r.ratings),
//   }));
// };

// // =========================================================
// // 🔹 Fetch a single reel by ID
// // =========================================================
// export const getReelById = async (reelId, viewerId = null, ipHash = null) => {
//   try {
//     await prisma.reelView.create({
//       data: { reelId, userId: viewerId, ipHash },
//     });
//   } catch { /* duplicate view – skip */ }

//   const reel = await prisma.reel.findUniqueOrThrow({
//     where:   { id: reelId },
//     include: {
//       player: {
//         select: {
//           id:       true,
//           fullname: true,
//           profile:  { select: { avatarUrl: true, position: true, country: true } },
//         },
//       },
//       ...REEL_WITH_REVIEWS,
//     },
//   });

//   return { ...reel, averageRating: avgRating(reel.ratings) };
// };