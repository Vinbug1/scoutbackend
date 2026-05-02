import prisma from '../lib/prisma.js';

const ratingService = {

  async createRating({ score, videoId, userId }) {
    return prisma.rating.create({
      data: {
        score,
        videoId: Number(videoId),
        userId: Number(userId),
      },
    });
  },

  async getAllRatings() {
    return prisma.rating.findMany({
      include: { user: true, video: true },
    });
  },

  async getRatingById(id) {
    const rating = await prisma.rating.findUnique({
      where: { id },
      include: { user: true, video: true },
    });

    if (!rating) {
      const error = new Error('Rating not found');
      error.statusCode = 404;
      throw error;
    }

    return rating;
  },

  async updateRating(id, { score }) {
    return prisma.rating.update({
      where: { id },
      data: { score },
    });
  },

  async deleteRating(id) {
    return prisma.rating.delete({ where: { id } });
  },
};

export default ratingService;