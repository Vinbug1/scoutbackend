import followerService from '../services/followerService.js';

// Returns null for anything that isn't a positive integer, instead of
// letting NaN or negative numbers reach Prisma (where they surface as a
// generic 500 instead of a clean 400).
function parsePositiveInt(value) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const MAX_LIMIT = 100;

const followerController = {
  // POST /users/:id/follow
  async follow(req, res) {
    try {
      const followerId = req.user.id; // authenticated user — never take this from req.body
      const followedId = parsePositiveInt(req.params.id);
      if (!followedId) {
        return res.status(400).json({ error: 'Invalid user id' });
      }

      const result = await followerService.follow(followerId, followedId);
      res.status(200).json({
        success: true,
        data: { following: result.following, followersCount: result.followersCount },
      });
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to follow user',
      });
    }
  },

  // DELETE /users/:id/follow
  async unfollow(req, res) {
    try {
      const followerId = req.user.id;
      const followedId = parsePositiveInt(req.params.id);
      if (!followedId) {
        return res.status(400).json({ error: 'Invalid user id' });
      }

      const result = await followerService.unfollow(followerId, followedId);
      res.status(200).json({
        success: true,
        data: { following: result.following, followersCount: result.followersCount },
      });
    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to unfollow user',
      });
    }
  },

  // GET /users/:id/followers?page=&limit=
  async getFollowers(req, res) {
    try {
      const userId = parsePositiveInt(req.params.id);
      if (!userId) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      const viewerId = req.user?.id;
      const page = parsePositiveInt(req.query.page) || 1;
      const limit = Math.min(parsePositiveInt(req.query.limit) || 20, MAX_LIMIT);

      const result = await followerService.getFollowers(userId, { viewerId, page, limit });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch followers' });
    }
  },

  // GET /users/:id/following?page=&limit=
  async getFollowing(req, res) {
    try {
      const userId = parsePositiveInt(req.params.id);
      if (!userId) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      const viewerId = req.user?.id;
      const page = parsePositiveInt(req.query.page) || 1;
      const limit = Math.min(parsePositiveInt(req.query.limit) || 20, MAX_LIMIT);

      const result = await followerService.getFollowing(userId, { viewerId, page, limit });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch following' });
    }
  },
};

export default followerController;

