import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// const prisma = new PrismaClient();

const CommentController = {
  // Create a new comment
  async createComment(req, res) {
    try {
      const { text, userId, postId, videoId } = req.body;
      if (!text || !userId) {
        return res.status(400).json({ message: "text and userId are required" });
      }
      if (!postId && !videoId) {
        return res.status(400).json({ message: "Either postId or videoId is required" });
      }
      const comment = await prisma.comment.create({
        data: {
          text,
          userId,
          postId: postId || null,
          videoId: videoId || null
        }
      });
      return res.status(201).json(comment);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Failed to create comment" });
    }
  },

  // Get all comments (optional filter by post or video)
  async getComments(req, res) {
    try {
      const { postId, videoId } = req.query;
      const comments = await prisma.comment.findMany({
        where: {
          postId: postId ? Number(postId) : undefined,
          videoId: videoId ? Number(videoId) : undefined
        },
        include: {
          user: true,
          post: true,
          video: true
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(comments);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Failed to fetch comments" });
    }
  },

  // Get a single comment
  async getCommentById(req, res) {
    try {
      const id = Number(req.params.id);
      const comment = await prisma.comment.findUnique({
        where: { id },
        include: { user: true, post: true, video: true }
      });
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }
      return res.status(200).json(comment);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Failed to fetch comment" });
    }
  },

  // Update comment
  async updateComment(req, res) {
    try {
      const id = Number(req.params.id);
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ message: "text is required" });
      }
      const updated = await prisma.comment.update({
        where: { id },
        data: { text }
      });
      return res.status(200).json(updated);
    } catch (error) {
      console.log(error);
      if (error.code === "P2025") {
        return res.status(404).json({ message: "Comment not found" });
      }
      return res.status(500).json({ message: "Failed to update comment" });
    }
  },

  // Delete comment
  async deleteComment(req, res) {
    try {
      const id = Number(req.params.id);
      await prisma.comment.delete({
        where: { id }
      });
      return res.status(200).json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.log(error);
      if (error.code === "P2025") {
        return res.status(404).json({ message: "Comment not found" });
      }
      return res.status(500).json({ message: "Failed to delete comment" });
    }
  }
};

export default CommentController;