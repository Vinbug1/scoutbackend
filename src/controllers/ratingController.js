import ratingService from '../services/ratingService.js';

const ratingController = {

  // Create a rating
  async createRating(req, res) {
    try {
      const { score, videoId, userId } = req.body;

      if (!score || score < 1 || score > 5) {
        return res.status(400).json({ error: 'Score must be between 1 and 5' });
      }

      const rating = await ratingService.createRating({ score, videoId, userId });
      return res.status(201).json(rating);
    } catch (err) {
      console.error(err);
      if (err.code === 'P2002') {
        return res.status(400).json({ error: 'You have already rated this video.' });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Get all ratings
  async getAllRatings(req, res) {
    try {
      const ratings = await ratingService.getAllRatings();
      return res.status(200).json(ratings);
    } catch (err) {
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Get rating by ID
  async getRatingById(req, res) {
    try {
      const id = Number(req.params.id);
      const rating = await ratingService.getRatingById(id);
      return res.status(200).json(rating);
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({ error: err.statusCode ? err.message : 'Server error' });
    }
  },

  // Update rating
  async updateRating(req, res) {
    try {
      const id = Number(req.params.id);
      const { score } = req.body;

      if (score < 1 || score > 5) {
        return res.status(400).json({ error: 'Score must be between 1 and 5' });
      }

      const rating = await ratingService.updateRating(id, { score });
      return res.status(200).json(rating);
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Rating not found' });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Delete rating
  async deleteRating(req, res) {
    try {
      const id = Number(req.params.id);
      await ratingService.deleteRating(id);
      return res.status(200).json({ message: 'Rating deleted successfully' });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Rating not found' });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  },
};

export default ratingController;