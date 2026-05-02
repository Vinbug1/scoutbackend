import prisma from '../lib/prisma.js';

const commentService = {

  async createComment({ text, userId, postId, videoId }) {
    return prisma.comment.create({
      data: {
        text,
        userId,
        postId: postId || null,
        videoId: videoId || null,
      }
    });
  },

  async getComments({ postId, videoId }) {
    return prisma.comment.findMany({
      where: {
        postId: postId ? Number(postId) : undefined,
        videoId: videoId ? Number(videoId) : undefined,
      },
      include: {
        user: true,
        post: true,
        video: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getCommentById(id) {
    const comment = await prisma.comment.findUnique({
      where: { id },
      include: { user: true, post: true, video: true }
    });

    if (!comment) {
      const error = new Error('Comment not found');
      error.statusCode = 404;
      throw error;
    }

    return comment;
  },

  async updateComment(id, { text }) {
    return prisma.comment.update({
      where: { id },
      data: { text }
    });
  },

  async deleteComment(id) {
    return prisma.comment.delete({
      where: { id }
    });
  }
};

export default commentService;