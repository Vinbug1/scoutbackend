import followerService from '../services/followerService.js';

const followerController = {

  // Get all followers
  async getAll(req, res) {
    try {
      const followers = await followerService.getAll();
      res.json(followers);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch followers' });
    }
  },

  // Get a single follower relationship by ID
  async getById(req, res) {
    try {
      const id = parseInt(req.params.id);
      const follower = await followerService.getById(id);
      res.json(follower);
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.statusCode ? error.message : 'Failed to fetch follower' });
    }
  },

  // Create a new follower relationship
  async create(req, res) {
    try {
      const { followerId, followedId } = req.body;

      if (followerId === followedId) {
        return res.status(400).json({ error: 'User cannot follow themselves' });
      }

      const newFollower = await followerService.create({ followerId, followedId });
      res.status(201).json(newFollower);
    } catch (error) {
      console.error(error);
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'This follow relationship already exists' });
      }
      res.status(500).json({ error: 'Failed to create follower' });
    }
  },

  // Update a follower relationship
  async update(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { followedId } = req.body;

      const updatedFollower = await followerService.update(id, { followedId });
      res.json(updatedFollower);
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Follower not found' });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'This follow relationship already exists' });
      }
      res.status(500).json({ error: 'Failed to update follower' });
    }
  },

  // Delete a follower relationship
  async delete(req, res) {
    try {
      const id = parseInt(req.params.id);
      await followerService.delete(id);
      res.json({ message: 'Follower relationship deleted successfully' });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Follower not found' });
      }
      res.status(500).json({ error: 'Failed to delete follower' });
    }
  }
};

export default followerController;