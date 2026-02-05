import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// const prisma = new PrismaClient();

const FollowerController = {
  // Get all followers
  async getAll(req, res) {
    try {
      const followers = await prisma.follower.findMany({
        include: {
          follower: true,
          followed: true,
        },
      });
      res.json(followers);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch followers' });
    }
  },

  // Get a single follower relationship by ID
  async getById(req, res) {
    const { id } = req.params;
    try {
      const follower = await prisma.follower.findUnique({
        where: { id: parseInt(id) },
        include: {
          follower: true,
          followed: true,
        },
      });
      if (!follower) {
        return res.status(404).json({ error: 'Follower not found' });
      }
      res.json(follower);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch follower' });
    }
  },

  // Create a new follower relationship
  async create(req, res) {
    const { followerId, followedId } = req.body;
    if (followerId === followedId) {
      return res.status(400).json({ error: 'User cannot follow themselves' });
    }
    try {
      const newFollower = await prisma.follower.create({
        data: { followerId, followedId },
        include: {
          follower: true,
          followed: true,
        },
      });
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
    const { id } = req.params;
    const { followedId } = req.body;
    try {
      const updatedFollower = await prisma.follower.update({
        where: { id: parseInt(id) },
        data: { followedId },
        include: {
          follower: true,
          followed: true,
        },
      });
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
    const { id } = req.params;
    try {
      await prisma.follower.delete({ where: { id: parseInt(id) } });
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

export default FollowerController;