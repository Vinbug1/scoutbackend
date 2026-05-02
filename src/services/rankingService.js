import prisma from '../lib/prisma.js';

const rankingService = {

  async createRanking({ userId, score, reason }) {
    return prisma.ranking.create({
      data: {
        userId,
        score: score || 0,
        reason,
      },
    });
  },

  async getRankings() {
    return prisma.ranking.findMany({
      include: { user: true },
      orderBy: { score: 'desc' },
    });
  },

  async getRankingById(id) {
    const ranking = await prisma.ranking.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!ranking) {
      const error = new Error('Ranking not found.');
      error.statusCode = 404;
      throw error;
    }

    return ranking;
  },

  async updateRanking(id, { score, reason }) {
    return prisma.ranking.update({
      where: { id },
      data: { score, reason, updatedAt: new Date() },
    });
  },

  async deleteRanking(id) {
    return prisma.ranking.delete({ where: { id } });
  },
};

export default rankingService;