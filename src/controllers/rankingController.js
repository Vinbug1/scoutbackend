import rankingService from '../services/rankingService.js';

const rankingController = {

  // CREATE Ranking
  async createRanking(req, res) {
    try {
      const { userId, score, reason } = req.body;
      const ranking = await rankingService.createRanking({ userId, score, reason });
      res.status(201).json(ranking);
    } catch (error) {
      console.error(error);
      if (error.code === 'P2002') {
        return res.status(400).json({ message: 'Ranking for this user already exists.' });
      }
      res.status(500).json({ message: 'Failed to create ranking.' });
    }
  },

  // GET All Rankings
  async getRankings(req, res) {
    try {
      const rankings = await rankingService.getRankings();
      res.json(rankings);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Failed to fetch rankings.' });
    }
  },

  // GET Ranking by ID
  async getRankingById(req, res) {
    try {
      const id = Number(req.params.id);
      const ranking = await rankingService.getRankingById(id);
      res.json(ranking);
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.statusCode ? error.message : 'Failed to fetch ranking.' });
    }
  },

  // UPDATE Ranking
  async updateRanking(req, res) {
    try {
      const id = Number(req.params.id);
      const { score, reason } = req.body;
      const ranking = await rankingService.updateRanking(id, { score, reason });
      res.json(ranking);
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Ranking not found.' });
      }
      res.status(500).json({ message: 'Failed to update ranking.' });
    }
  },

  // DELETE Ranking
  async deleteRanking(req, res) {
    try {
      const id = Number(req.params.id);
      await rankingService.deleteRanking(id);
      res.json({ message: 'Ranking deleted successfully.' });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Ranking not found.' });
      }
      res.status(500).json({ message: 'Failed to delete ranking.' });
    }
  },
};

export default rankingController;