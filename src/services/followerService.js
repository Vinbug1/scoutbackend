import prisma from '../lib/prisma.js';

const followerService = {

  async getAll() {
    return prisma.follower.findMany({
      include: {
        follower: true,
        followed: true,
      },
    });
  },

  async getById(id) {
    const follower = await prisma.follower.findUnique({
      where: { id },
      include: {
        follower: true,
        followed: true,
      },
    });

    if (!follower) {
      const error = new Error('Follower not found');
      error.statusCode = 404;
      throw error;
    }

    return follower;
  },

  async create({ followerId, followedId }) {
    return prisma.follower.create({
      data: { followerId, followedId },
      include: {
        follower: true,
        followed: true,
      },
    });
  },

  async update(id, { followedId }) {
    return prisma.follower.update({
      where: { id },
      data: { followedId },
      include: {
        follower: true,
        followed: true,
      },
    });
  },

  async delete(id) {
    return prisma.follower.delete({ where: { id } });
  }
};

export default followerService;