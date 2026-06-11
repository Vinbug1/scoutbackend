import ratingService from '../services/ratingService.js';

const ratingController = {

  // POST /api/ratings
  async createRating(req, res) {
    try {
      const { score, videoId, reelId, userId } = req.body;

      if (!score || score < 1 || score > 5) {
        return res.status(400).json({ error: 'Score must be between 1 and 5.' });
      }

      if (!userId) {
        return res.status(400).json({ error: 'userId is required.' });
      }

      // Must rate either a video or a reel, not neither
      if (!videoId && !reelId) {
        return res.status(400).json({ error: 'Either videoId or reelId is required.' });
      }

      const rating = await ratingService.createRating({ score, videoId, reelId, userId });
      return res.status(201).json(rating);
    } catch (err) {
      console.error('[Rating] createRating error:', err);
      if (err.code === 'P2002') {
        return res.status(400).json({ error: 'You have already rated this video.' });
      }
      if (err.code === 'P2003') {
        return res.status(400).json({ error: 'Referenced video, reel, or user does not exist.' });
      }
      return res.status(500).json({ error: 'Server error.' });
    }
  },

  // GET /api/ratings
  async getAllRatings(req, res) {
    try {
      const ratings = await ratingService.getAllRatings();
      return res.status(200).json(ratings);
    } catch (err) {
      console.error('[Rating] getAllRatings error:', err);
      return res.status(500).json({ error: 'Server error.' });
    }
  },

  // GET /api/ratings/:id
  async getRatingById(req, res) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid rating ID.' });
      }

      const rating = await ratingService.getRatingById(id);
      return res.status(200).json(rating);
    } catch (err) {
      console.error('[Rating] getRatingById error:', err);
      const status = err.statusCode || 500;
      return res.status(status).json({
        error: err.statusCode ? err.message : 'Server error.',
      });
    }
  },

  // PATCH /api/ratings/:id
  async updateRating(req, res) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid rating ID.' });
      }

      const { score } = req.body;
      if (!score || score < 1 || score > 5) {
        return res.status(400).json({ error: 'Score must be between 1 and 5.' });
      }

      const rating = await ratingService.updateRating(id, { score });
      return res.status(200).json(rating);
    } catch (err) {
      console.error('[Rating] updateRating error:', err);
      if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Rating not found.' });
      }
      return res.status(500).json({ error: 'Server error.' });
    }
  },

  // DELETE /api/ratings/:id
  async deleteRating(req, res) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid rating ID.' });
      }

      await ratingService.deleteRating(id);
      return res.status(200).json({ message: 'Rating deleted successfully.' });
    } catch (err) {
      console.error('[Rating] deleteRating error:', err);
      if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Rating not found.' });
      }
      return res.status(500).json({ error: 'Server error.' });
    }
  },
};

export default ratingController;
