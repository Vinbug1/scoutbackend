import fs from 'fs';
import scoutProfileService from '../services/scoutProfileService.js';

const ScoutProfileController = {

  // ✅ Public - anyone can view all scout profiles
  async getScoutProfiles(req, res) {
    try {
      const result = await scoutProfileService.getAll(req.query);
      res.status(200).json(result);
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to fetch scout profiles' });
    }
  },

  // ✅ Public - anyone can view a scout profile by userId
  async getScoutProfileById(req, res) {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

      const profile = await scoutProfileService.getById(userId);
      res.status(200).json({ data: profile });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to fetch scout profile' });
    }
  },

  // ✅ SCOUT only - can only update their own profile
  async updateScoutProfile(req, res) {
    try {
      const userId = req.user.userId;

      const profile = await scoutProfileService.update(userId, req.body);
      res.status(200).json({ message: 'Scout profile updated successfully', data: profile });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to update scout profile' });
    }
  },

  // ✅ SCOUT only - can only delete their own profile
  async deleteScoutProfile(req, res) {
    try {
      const userId = req.user.userId;

      await scoutProfileService.delete(userId);
      res.status(200).json({ message: 'Scout profile deleted successfully' });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to delete scout profile' });
    }
  },

  // ✅ SCOUT only - upload their own avatar
  async uploadAvatar(req, res) {
    try {
      const userId = req.user.userId;

      // req.file now comes from diskStorage — has .path, not .buffer
      const result = await scoutProfileService.uploadAvatar(userId, req.file);
      res.status(200).json(result);
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to upload avatar' });
    } finally {
      // ✅ Always clean up the temp disk file multer wrote, regardless of success/failure
      if (req.file?.path) {
        fs.unlink(req.file.path, () => {});
      }
    }
  },
};

export default ScoutProfileController;








