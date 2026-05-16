import { PrismaClient } from '@prisma/client';
import { uploadMediaToGCS } from '../config/multer.js';
const prisma = new PrismaClient();

// =========================================================
// 🔹 Common video include block (reviews + ratings + views)
// =========================================================
const VIDEO_WITH_REVIEWS = {
  comments: {
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id:      true,
          fullname:true,
          profile: { select: { avatarUrl: true } },
        },
      },
    },
  },
  ratings: {
    include: {
      user: {
        select: {
          id:      true,
          fullname:true,
        },
      },
    },
  },
  _count: {
    select: { views: true, comments: true, ratings: true },
  },
};

// Compute average rating from a ratings array
const avgRating = (ratings) =>
  ratings.length
    ? parseFloat((ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1))
    : null;

// =========================================================
// 🔹 Upload a video for a player
// =========================================================
/**
 * Converts the uploaded file to HLS, saves to GCS, then persists
 * a Video record in the database.
 *
 * @param {object} multerFile   - req.file from multer
 * @param {object} meta         - { title, description, published }
 * @param {number} playerId     - resolved player id (from JWT or body)
 * @returns {Promise<Video>}
 */
export const uploadVideo = async (multerFile, meta, playerId) => {  // ← remove thumbnailFile
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: { id: true, role: true },
  });

  if (!player) {
    throw Object.assign(new Error('Player not found.'), { statusCode: 404 });
  }

  if (player.role !== 'PLAYER') {
    throw Object.assign(
      new Error('The target user is not a player.'),
      { statusCode: 400 },
    );
  }

  // Single upload — thumbnail is auto-generated inside convertAndUploadHLS
  const { url, mp4Url, thumbnailUrl, durationSec, sizeKB, uploadTimeMS } =
    await uploadMediaToGCS(multerFile, `videos/${playerId}`);

  console.log(`✅ HLS ready [${sizeKB} KB, ${uploadTimeMS} ms]`);

  const video = await prisma.video.create({
    data: {
      videoUrl:     url,
      mp4Url:       mp4Url       ?? null,
      thumbnailUrl: thumbnailUrl ?? null,  // ← comes from video frame now
      title:        meta.title,
      description:  meta.description ?? null,
      published:    meta.published   ?? false,
      durationSec:  durationSec      ?? null,
      playerId,
    },
  });

  return video;
};

// export const uploadVideo = async (multerFile, meta, playerId) => {
//   // ── Verify the playerId belongs to a real PLAYER ──────────────────────────
//   const player = await prisma.user.findUnique({
//     where: { id: playerId },
//     select: { id: true, role: true },
//   });

//   if (!player) {
//     throw Object.assign(new Error('Player not found.'), { statusCode: 404 });
//   }

//   if (player.role !== 'PLAYER') {
//     throw Object.assign(
//       new Error('The target user is not a player.'),
//       { statusCode: 400 },
//     );
//   }
//   // ─────────────────────────────────────────────────────────────────────────

//   const { url, durationSec, sizeKB, uploadTimeMS } = await uploadMediaToGCS(
//     multerFile,
//     `videos/${playerId}`,
//   );

//   console.log(`✅ HLS ready [${sizeKB} KB, ${uploadTimeMS} ms]`);

//   const video = await prisma.video.create({
//     data: {
//       videoUrl:    url,
//       title:       meta.title,
//       description: meta.description ?? null,
//       published:   meta.published   ?? false,
//       durationSec: durationSec      ?? null,
//       playerId,
//     },
//   });

//   return video;
// };

// =========================================================
// 🔹 Upload / update profile avatar
// =========================================================
export const uploadAvatar = async (multerFile, userId) => {
  const { url } = await uploadMediaToGCS(multerFile, `avatars/${userId}`);

  const profile = await prisma.profile.upsert({
    where:  { userId },
    update: { avatarUrl: url },
    create: { userId, avatarUrl: url },
  });

  return profile;
};

// =========================================================
// 🔹 Fetch all videos for a given player (by userId)
// =========================================================
export const getVideosByUser = async (playerId) => {
  const videos = await prisma.video.findMany({
    where:   { playerId },
    orderBy: { createdAt: 'desc' },
    include: VIDEO_WITH_REVIEWS,
  });

  return videos.map((v) => ({
    ...v,
    averageRating: avgRating(v.ratings),
  }));
};

// =========================================================
// 🔹 Fetch logged-in user profile + all their videos
// =========================================================
export const getMyProfileWithVideos = async (userId) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id:       true,
      email:    true,
      fullname: true,
      role:     true,
      profile:  true,

      videos: {
        orderBy: { createdAt: 'desc' },
        include: VIDEO_WITH_REVIEWS,
      },
    },
  });

  const videosWithRating = user.videos.map((v) => ({
    ...v,
    averageRating: avgRating(v.ratings),
  }));

  return { ...user, videos: videosWithRating };
};

// =========================================================
// 🔹 Fetch a single video (public – any viewer)
// =========================================================
export const getVideoById = async (videoId, viewerId = null, ipHash = null) => {
  try {
    await prisma.videoView.create({
      data: { videoId, userId: viewerId, ipHash },
    });
  } catch { /* duplicate view – skip */ }

  const video = await prisma.video.findUniqueOrThrow({
    where:   { id: videoId },
    include: {
      player: {
        select: {
          id:      true,
          fullname:true,
          profile: { select: { avatarUrl: true, position: true, country: true } },
        },
      },
      ...VIDEO_WITH_REVIEWS,
    },
  });

  return { ...video, averageRating: avgRating(video.ratings) };
};






















// import { PrismaClient } from '@prisma/client';
// // ✅ These also need .js extensions
// import { uploadMediaToGCS } from '../config/multer.js';
// const prisma = new PrismaClient();
// // =========================================================
// // 🔹 Common video include block (reviews + ratings + views)
// // =========================================================
// const VIDEO_WITH_REVIEWS = {
//   comments: {
//     orderBy: { createdAt: 'desc' },
//     include: {
//       user: {
//         select: {
//           id:      true,
//           fullname:true,
//           profile: { select: { avatarUrl: true } },
//         },
//       },
//     },
//   },
//   ratings: {
//     include: {
//       user: {
//         select: {
//           id:      true,
//           fullname:true,
//         },
//       },
//     },
//   },
//   _count: {
//     select: { views: true, comments: true, ratings: true },
//   },
// };

// // Compute average rating from a ratings array
// const avgRating = (ratings) =>
//   ratings.length
//     ? parseFloat((ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1))
//     : null;

// // =========================================================
// // 🔹 Upload a video for a player
// // =========================================================
// /**
//  * Converts the uploaded file to HLS, saves to GCS, then persists
//  * a Video record in the database.
//  *
//  * @param {object} multerFile   - req.file from multer
//  * @param {object} meta         - { title, description, published }
//  * @param {number} playerId     - authenticated user's id
//  * @returns {Promise<Video>}
//  */
// export const uploadVideo = async (multerFile, meta, playerId) => {
//   const { url, durationSec, sizeKB, uploadTimeMS } = await uploadMediaToGCS(
//     multerFile,
//     `videos/${playerId}`,
//   );

//   console.log(`✅ HLS ready [${sizeKB} KB, ${uploadTimeMS} ms]`);

//   const video = await prisma.video.create({
//     data: {
//       videoUrl:    url,
//       title:       meta.title,
//       description: meta.description ?? null,
//       published:   meta.published   ?? false,
//       durationSec: durationSec      ?? null,
//       playerId,
//     },
//   });

//   return video;
// };

// // =========================================================
// // 🔹 Upload / update profile avatar
// // =========================================================
// /**
//  * Upload an image and update (or create) the user's Profile avatar.
//  *
//  * @param {object} multerFile
//  * @param {number} userId
//  * @returns {Promise<Profile>}
//  */
// export const uploadAvatar = async (multerFile, userId) => {
//   const { url } = await uploadMediaToGCS(multerFile, `avatars/${userId}`);

//   const profile = await prisma.profile.upsert({
//     where:  { userId },
//     update: { avatarUrl: url },
//     create: { userId, avatarUrl: url },
//   });

//   return profile;
// };

// // =========================================================
// // 🔹 Fetch all videos for a given player (by userId)
// // =========================================================
// /**
//  * Returns every video belonging to the player, each enriched with
//  * comments, ratings and view/comment/rating counts.
//  *
//  * @param {number} playerId
//  * @returns {Promise<Array>}
//  */
// export const getVideosByUser = async (playerId) => {
//   const videos = await prisma.video.findMany({
//     where:   { playerId },
//     orderBy: { createdAt: 'desc' },
//     include: VIDEO_WITH_REVIEWS,
//   });

//   return videos.map((v) => ({
//     ...v,
//     averageRating: avgRating(v.ratings),
//   }));
// };

// // =========================================================
// // 🔹 Fetch logged-in user profile + all their videos
// // =========================================================
// /**
//  * Returns:
//  *  - user (id, email, fullname, role)
//  *  - profile (avatarUrl, position, country, …)
//  *  - videos[] each with comments, ratings, counts
//  *
//  * @param {number} userId   - from req.user.userId (JWT payload)
//  * @returns {Promise<object>}
//  */
// export const getMyProfileWithVideos = async (userId) => {
//   const user = await prisma.user.findUniqueOrThrow({
//     where: { id: userId },
//     select: {
//       id:       true,
//       email:    true,
//       fullname: true,
//       role:     true,
//       profile:  true,         // avatar + all profile fields

//       videos: {
//         orderBy: { createdAt: 'desc' },
//         include: VIDEO_WITH_REVIEWS,
//       },
//     },
//   });

//   // Enrich each video with a computed averageRating
//   const videosWithRating = user.videos.map((v) => ({
//     ...v,
//     averageRating: avgRating(v.ratings),
//   }));

//   return { ...user, videos: videosWithRating };
// };

// // =========================================================
// // 🔹 Fetch a single video (public – any viewer)
// // =========================================================
// /**
//  * Returns a single video with all reviews.
//  * Also records a view if viewerId is provided.
//  *
//  * @param {number}      videoId
//  * @param {number|null} viewerId   - logged-in user id (or null)
//  * @param {string|null} ipHash     - hashed IP for anonymous views
//  */
// export const getVideoById = async (videoId, viewerId = null, ipHash = null) => {
//   // Record view (ignore unique-constraint errors = already viewed)
//   try {
//     await prisma.videoView.create({
//       data: { videoId, userId: viewerId, ipHash },
//     });
//   } catch { /* duplicate view – skip */ }

//   const video = await prisma.video.findUniqueOrThrow({
//     where:   { id: videoId },
//     include: {
//       player: {
//         select: {
//           id:      true,
//           fullname:true,
//           profile: { select: { avatarUrl: true, position: true, country: true } },
//         },
//       },
//       ...VIDEO_WITH_REVIEWS,
//     },
//   });

//   return { ...video, averageRating: avgRating(video.ratings) };
// };