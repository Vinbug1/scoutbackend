// controllers/videoViewController.js
import prisma from '../lib/prisma.js';  // or '../config/prisma.js'

// const prisma = new PrismaClient();

const VideoViewController = {
  /**
   * CREATE a new VideoView
   * - Enforces unique (videoId, userId) if defined in schema
   */
  async createView(req, res) {
    try {
      const { videoId, userId, ipHash } = req.body;
      const newView = await prisma.videoView.create({
        data: {
          videoId,
          userId: userId || null,
          ipHash: ipHash || null
        }
      });
      return res.status(201).json(newView);
    } catch (err) {
      console.error(err);
      // Handle unique constraint error
      if (err.code === "P2002") {
        return res.status(400).json({
          message: "User has already viewed this video (unique constraint)"
        });
      }
      return res.status(500).json({ error: "Failed to create video view" });
    }
  },

  /**
   * GET ALL video views
   */
  async getAllViews(req, res) {
    try {
      const views = await prisma.videoView.findMany({
        include: {
          video: true,
          user: true
        }
      });
      return res.status(200).json(views);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch views" });
    }
  },

  /**
   * GET a single video view by ID
   */
  async getViewById(req, res) {
    try {
      const id = Number(req.params.id);
      const view = await prisma.videoView.findUnique({
        where: { id },
        include: {
          video: true,
          user: true
        }
      });
      if (!view) {
        return res.status(404).json({ message: "Video view not found" });
      }
      return res.status(200).json(view);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch video view" });
    }
  },

  /**
   * UPDATE a video view (usually not common but included for CRUD completeness)
   */
  async updateView(req, res) {
    try {
      const id = Number(req.params.id);
      const { videoId, userId, ipHash } = req.body;
      const updatedView = await prisma.videoView.update({
        where: { id },
        data: {
          videoId,
          userId: userId || null,
          ipHash: ipHash || null
        }
      });
      return res.status(200).json(updatedView);
    } catch (err) {
      console.error(err);
      if (err.code === "P2002") {
        return res.status(400).json({
          message: "Duplicate view — this user already viewed this video"
        });
      }
      return res.status(500).json({ error: "Failed to update video view" });
    }
  },

  /**
   * DELETE a video view
   */
  async deleteView(req, res) {
    try {
      const id = Number(req.params.id);
      await prisma.videoView.delete({
        where: { id }
      });
      return res.status(200).json({ message: "Video view deleted" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to delete video view" });
    }
  }
};

export default VideoViewController;