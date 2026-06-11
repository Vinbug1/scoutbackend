import prisma from '../lib/prisma.js';

const commentService = {

  async createComment({ text, userId, postId, videoId, reelId }) {
    return prisma.comment.create({
      data: {
        text,
        userId:  Number(userId),
        postId:  postId  ? Number(postId)  : null,
        videoId: videoId ? Number(videoId) : null,
        reelId:  reelId  ? Number(reelId)  : null,
      },
      include: {
        user:  { select: { id: true, fullname: true } },
        post:  true,
        video: true,
        reel:  true,
      },
    });
  },

  // Filter by postId, videoId, or reelId
  async getComments({ postId, videoId, reelId }) {
    return prisma.comment.findMany({
      where: {
        postId:  postId  ? Number(postId)  : undefined,
        videoId: videoId ? Number(videoId) : undefined,
        reelId:  reelId  ? Number(reelId)  : undefined,
      },
      include: {
        user:  { select: { id: true, fullname: true } },
        post:  true,
        video: true,
        reel:  true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getCommentById(id) {
    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        user:  { select: { id: true, fullname: true } },
        post:  true,
        video: true,
        reel:  true,
      },
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
      data:  { text },
    });
  },

  async deleteComment(id) {
    return prisma.comment.delete({ where: { id } });
  },
};

export default commentService;


