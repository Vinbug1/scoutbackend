import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// const prisma = new PrismaClient();

const RankingController = {
  // CREATE Ranking
  async createRanking(req, res) {
    try {
      const { userId, score, reason } = req.body;
      const ranking = await prisma.ranking.create({
        data: {
          userId,
          score: score || 0,
          reason
        }
      });
      res.status(201).json(ranking);
    } catch (error) {
      console.error(error);
      if (error.code === 'P2002') {
        return res.status(400).json({
          message: "Ranking for this user already exists."
        });
      }
      res.status(500).json({ message: "Failed to create ranking." });
    }
  },

  // GET All Rankings
  async getRankings(req, res) {
    try {
      const rankings = await prisma.ranking.findMany({
        include: { user: true },
        orderBy: { score: 'desc' }
      });
      res.json(rankings);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch rankings." });
    }
  },

  // GET Ranking by ID
  async getRankingById(req, res) {
    try {
      const { id } = req.params;
      const ranking = await prisma.ranking.findUnique({
        where: { id: Number(id) },
        include: { user: true }
      });
      if (!ranking) {
        return res.status(404).json({ message: "Ranking not found." });
      }
      res.json(ranking);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch ranking." });
    }
  },

  // UPDATE Ranking
  async updateRanking(req, res) {
    try {
      const { id } = req.params;
      const { score, reason } = req.body;
      const ranking = await prisma.ranking.update({
        where: { id: Number(id) },
        data: { score, reason, updatedAt: new Date() }
      });
      res.json(ranking);
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: "Ranking not found." });
      }
      res.status(500).json({ message: "Failed to update ranking." });
    }
  },

  // DELETE Ranking
  async deleteRanking(req, res) {
    try {
      const { id } = req.params;
      await prisma.ranking.delete({ where: { id: Number(id) } });
      res.json({ message: "Ranking deleted successfully." });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: "Ranking not found." });
      }
      res.status(500).json({ message: "Failed to delete ranking." });
    }
  }
};

export default RankingController;