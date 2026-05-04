// ✅ With .js extension
import {
  uploadVideo,
  uploadAvatar,
  getVideosByUser,
  getMyProfileWithVideos,
  getVideoById,
} from '../services/videoService.js';

// =========================================================
// POST /api/videos/upload
// multipart field name: "video"
// body: { title, description?, published? }
// =========================================================
export const handleVideoUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file provided.' });
    }

    const { title, description, published } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Video title is required.' });
    }

    const video = await uploadVideo(
      req.file,
      { title: title.trim(), description, published: published === 'true' },
      req.user.id,   // set by your auth middleware
    );

    return res.status(201).json({
      success: true,
      message: 'Video uploaded and converted to HLS successfully.',
      data: video,
    });
  } catch (err) {
    console.error('❌ handleVideoUpload:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// POST /api/users/avatar
// multipart field name: "avatar"
// =========================================================
export const handleAvatarUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided.' });
    }

    const profile = await uploadAvatar(req.file, req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Avatar updated.',
      data: profile,
    });
  } catch (err) {
    console.error('❌ handleAvatarUpload:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// GET /api/users/:userId/videos
// Public: fetch all videos for any player by userId
// =========================================================
export const handleGetUserVideos = async (req, res) => {
  try {
    const playerId = parseInt(req.params.userId, 10);
    if (isNaN(playerId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const videos = await getVideosByUser(playerId);

    return res.status(200).json({ success: true, data: videos });
  } catch (err) {
    console.error('❌ handleGetUserVideos:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// GET /api/me
// Protected: full profile + videos for the logged-in user
// =========================================================
export const handleGetMyProfile = async (req, res) => {
  try {
    const data = await getMyProfileWithVideos(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('❌ handleGetMyProfile:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// GET /api/videos/:videoId
// Public: single video with reviews + view tracking
// =========================================================
export const handleGetVideo = async (req, res) => {
  try {
    const videoId  = parseInt(req.params.videoId, 10);
    if (isNaN(videoId)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID.' });
    }

    // viewerId: present if request is authenticated, null otherwise
    const viewerId = req.user?.userId ?? null;

    // Basic IP hashing for anonymous view deduplication
    const rawIp  = req.ip || req.headers['x-forwarded-for'] || '';
    const ipHash = rawIp
      ? Buffer.from(rawIp).toString('base64').slice(0, 32)
      : null;

    const video = await getVideoById(videoId, viewerId, ipHash);
    return res.status(200).json({ success: true, data: video });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Video not found.' });
    }
    console.error('❌ handleGetVideo:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};




















// // controllers/videoController.js
// import prisma from '../lib/prisma.js';  // or '../config/prisma.js'

// // const prisma = new PrismaClient();

// const VideoController = {
//   /**
//    * Create a new video
//    */
//   async createVideo(req, res) {
//     try {
//       const {
//         videoUrl,
//         thumbnailUrl,
//         title,
//         description,
//         published,
//         durationSec,
//         playerId,
//       } = req.body;

//       const newVideo = await prisma.video.create({
//         data: {
//           videoUrl,
//           thumbnailUrl,
//           title,
//           description,
//           published: published ?? false,
//           durationSec,
//           playerId,
//         },
//       });

//       return res.status(201).json({ success: true, data: newVideo });
//     } catch (error) {
//       console.error("Create Video Error:", error);
//       return res.status(500).json({ success: false, message: "Server Error" });
//     }
//   },

//   /**
//    * Get all videos (with pagination & optional filters)
//    */
//   async getAllVideos(req, res) {
//     try {
//       const { page = 1, limit = 20, published } = req.query;
//       const skip = (Number(page) - 1) * Number(limit);

//       const videos = await prisma.video.findMany({
//         skip,
//         take: Number(limit),
//         where: {
//           published: published !== undefined ? published === "true" : undefined,
//         },
//         orderBy: { createdAt: "desc" },
//         include: {
//           player: true,
//           views: true,
//           comments: true,
//           ratings: true,
//         },
//       });

//       return res.status(200).json({ success: true, data: videos });
//     } catch (error) {
//       console.error("Get Videos Error:", error);
//       return res.status(500).json({ success: false, message: "Server Error" });
//     }
//   },

//   /**
//    * Get a single video by ID (with relations)
//    */
//   async getVideoById(req, res) {
//     try {
//       const videoId = Number(req.params.id);

//       const video = await prisma.video.findUnique({
//         where: { id: videoId },
//         include: {
//           player: true,
//           views: true,
//           comments: true,
//           ratings: true,
//         },
//       });

//       if (!video) {
//         return res.status(404).json({ success: false, message: "Video not found" });
//       }

//       return res.status(200).json({ success: true, data: video });
//     } catch (error) {
//       console.error("Get Video Error:", error);
//       return res.status(500).json({ success: false, message: "Server Error" });
//     }
//   },

//   /**
//    * Update a video
//    */
//   async updateVideo(req, res) {
//     try {
//       const videoId = Number(req.params.id);
//       const {
//         videoUrl,
//         thumbnailUrl,
//         title,
//         description,
//         published,
//         durationSec,
//       } = req.body;

//       const updated = await prisma.video.update({
//         where: { id: videoId },
//         data: {
//           videoUrl,
//           thumbnailUrl,
//           title,
//           description,
//           published,
//           durationSec,
//         },
//       });

//       return res.status(200).json({ success: true, data: updated });
//     } catch (error) {
//       console.error("Update Video Error:", error);
//       if (error.code === "P2025") {
//         return res.status(404).json({ success: false, message: "Video not found" });
//       }
//       return res.status(500).json({ success: false, message: "Server Error" });
//     }
//   },

//   /**
//    * Delete a video
//    */
//   async deleteVideo(req, res) {
//     try {
//       const videoId = Number(req.params.id);

//       await prisma.video.delete({
//         where: { id: videoId },
//       });

//       return res.status(200).json({ success: true, message: "Video deleted" });
//     } catch (error) {
//       console.error("Delete Video Error:", error);
//       if (error.code === "P2025") {
//         return res.status(404).json({ success: false, message: "Video not found" });
//       }
//       return res.status(500).json({ success: false, message: "Server Error" });
//     }
//   },
// };

// export default VideoController;