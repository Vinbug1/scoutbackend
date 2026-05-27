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
          id:       true,
          fullname: true,
          profile:  { select: { avatarUrl: true } },
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

// Compute average rating from a ratings array
const avgRating = (ratings) =>
  ratings.length
    ? parseFloat((ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1))
    : null;

// =========================================================
// 🔹 Upload a video for a player
// =========================================================

export const uploadVideo = async (multerFile, meta, playerId) => {
  const player = await prisma.user.findUnique({
    where:  { id: playerId },
    select: { id: true, role: true },
  });

  if (!player) throw Object.assign(new Error('Player not found.'), { statusCode: 404 });
  if (player.role !== 'PLAYER') throw Object.assign(new Error('Target user is not a player.'), { statusCode: 400 });

  const { url, thumbnailUrl, durationSec, sizeKB, uploadTimeMS } =
    await uploadMediaToGCS(multerFile, `videos/${playerId}`);

  console.log(`✅ HLS ready [${sizeKB} KB, ${uploadTimeMS} ms]`);

  // ✅ If a pending record already exists, update it. Otherwise create fresh.
  if (meta.videoId) {
    return prisma.video.update({
      where: { id: meta.videoId },
      data: {
        videoUrl:     url,
        thumbnailUrl: thumbnailUrl ?? null,
        durationSec:  durationSec  ?? null,
        status:       'ready',
      },
    });
  }

  return prisma.video.create({
    data: {
      videoUrl:     url,
      thumbnailUrl: thumbnailUrl ?? null,
      title:        meta.title,
      description:  meta.description ?? null,
      published:    meta.published   ?? false,
      durationSec:  durationSec      ?? null,
      playerId,
      status:       'ready',
    },
  });
};
// export const uploadVideo = async (multerFile, meta, playerId) => {
//   const player = await prisma.user.findUnique({
//     where:  { id: playerId },
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

//   const { url, thumbnailUrl, durationSec, sizeKB, uploadTimeMS } =
//     await uploadMediaToGCS(multerFile, `videos/${playerId}`);

//   console.log(`✅ HLS ready [${sizeKB} KB, ${uploadTimeMS} ms]`);

//   const video = await prisma.video.create({
//     data: {
//       videoUrl:     url,
//       thumbnailUrl: thumbnailUrl ?? null,
//       title:        meta.title,
//       description:  meta.description ?? null,
//       published:    meta.published   ?? false,
//       durationSec:  durationSec      ?? null,
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
          id:       true,
          fullname: true,
          profile:  { select: { avatarUrl: true, position: true, country: true } },
        },
      },
      ...VIDEO_WITH_REVIEWS,
    },
  });

  return { ...video, averageRating: avgRating(video.ratings) };
};

// =========================================================
// 🔹 Create a placeholder record before processing starts
// =========================================================
export const createPendingVideo = async ({ title, description, published, playerId }) => {
  return prisma.video.create({
    data: {
      title,
      description: description ?? null,
      published:   published  ?? false,
      playerId,
      status:      'processing',
      videoUrl:    '',          // required field — will be updated when ready
      thumbnailUrl: null,
      durationSec:  null,
    },
  });
};

// =========================================================
// 🔹 Mark a video record as ready (or failed)
// =========================================================
export const updateVideoStatus = async (videoId, { status, videoUrl, thumbnailUrl, durationSec }) => {
  return prisma.video.update({
    where: { id: videoId },
    data:  { status, videoUrl, thumbnailUrl, durationSec },
  });
};

