import prisma from '../lib/prisma.js';

const VideoViewService = {
  async createView({ videoId, userId, ipHash }) {
    return await prisma.videoView.create({
      data: {
        videoId,
        userId: userId || null,
        ipHash: ipHash || null,
      },
    });
  },

  async getAllViews() {
    return await prisma.videoView.findMany({
      include: {
        video: true,
        user: true,
      },
    });
  },

  async getViewById(id) {
    return await prisma.videoView.findUnique({
      where: { id },
      include: {
        video: true,
        user: true,
      },
    });
  },

  async updateView(id, { videoId, userId, ipHash }) {
    return await prisma.videoView.update({
      where: { id },
      data: {
        videoId,
        userId: userId || null,
        ipHash: ipHash || null,
      },
    });
  },

  async deleteView(id) {
    return await prisma.videoView.delete({
      where: { id },
    });
  },
};

export default VideoViewService;