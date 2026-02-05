// controllers/videoController.js
import prisma from '../lib/prisma.js';  // or '../config/prisma.js'

// const prisma = new PrismaClient();

const VideoController = {
  /**
   * Create a new video
   */
  async createVideo(req, res) {
    try {
      const {
        videoUrl,
        thumbnailUrl,
        title,
        description,
        published,
        durationSec,
        playerId,
      } = req.body;

      const newVideo = await prisma.video.create({
        data: {
          videoUrl,
          thumbnailUrl,
          title,
          description,
          published: published ?? false,
          durationSec,
          playerId,
        },
      });

      return res.status(201).json({ success: true, data: newVideo });
    } catch (error) {
      console.error("Create Video Error:", error);
      return res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Get all videos (with pagination & optional filters)
   */
  async getAllVideos(req, res) {
    try {
      const { page = 1, limit = 20, published } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const videos = await prisma.video.findMany({
        skip,
        take: Number(limit),
        where: {
          published: published !== undefined ? published === "true" : undefined,
        },
        orderBy: { createdAt: "desc" },
        include: {
          player: true,
          views: true,
          comments: true,
          ratings: true,
        },
      });

      return res.status(200).json({ success: true, data: videos });
    } catch (error) {
      console.error("Get Videos Error:", error);
      return res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Get a single video by ID (with relations)
   */
  async getVideoById(req, res) {
    try {
      const videoId = Number(req.params.id);

      const video = await prisma.video.findUnique({
        where: { id: videoId },
        include: {
          player: true,
          views: true,
          comments: true,
          ratings: true,
        },
      });

      if (!video) {
        return res.status(404).json({ success: false, message: "Video not found" });
      }

      return res.status(200).json({ success: true, data: video });
    } catch (error) {
      console.error("Get Video Error:", error);
      return res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Update a video
   */
  async updateVideo(req, res) {
    try {
      const videoId = Number(req.params.id);
      const {
        videoUrl,
        thumbnailUrl,
        title,
        description,
        published,
        durationSec,
      } = req.body;

      const updated = await prisma.video.update({
        where: { id: videoId },
        data: {
          videoUrl,
          thumbnailUrl,
          title,
          description,
          published,
          durationSec,
        },
      });

      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("Update Video Error:", error);
      if (error.code === "P2025") {
        return res.status(404).json({ success: false, message: "Video not found" });
      }
      return res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Delete a video
   */
  async deleteVideo(req, res) {
    try {
      const videoId = Number(req.params.id);

      await prisma.video.delete({
        where: { id: videoId },
      });

      return res.status(200).json({ success: true, message: "Video deleted" });
    } catch (error) {
      console.error("Delete Video Error:", error);
      if (error.code === "P2025") {
        return res.status(404).json({ success: false, message: "Video not found" });
      }
      return res.status(500).json({ success: false, message: "Server Error" });
    }
  },
};

export default VideoController;