import profileService from '../services/profileService.js';

const ProfileController = {

  // ✅ Public - anyone can view all player profiles
  async getProfiles(req, res) {
    try {
      const result = await profileService.getAll(req.query);
      res.status(200).json(result);
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to fetch profiles' });
    }
  },

  // ✅ Public - anyone can view a player profile by userId
  async getProfileById(req, res) {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

      const profile = await profileService.getById(userId); // ✅ userId
      res.status(200).json({ data: profile });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to fetch profile' });
    }
  },

  // ✅ PLAYER only - can only update their own profile
  async updateProfile(req, res) {
    try {
      const userId = req.user.userId; // ✅ from JWT, not route param

      const profile = await profileService.update(userId, req.body);
      res.status(200).json({ message: 'Profile updated successfully', data: profile });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to update profile' });
    }
  },

  // ✅ PLAYER only - can only delete their own profile
  async deleteProfile(req, res) {
    try {
      const userId = req.user.userId; // ✅ from JWT, not route param

      await profileService.delete(userId);
      res.status(200).json({ message: 'Profile deleted successfully' });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to delete profile' });
    }
  },

  // ✅ PLAYER only - upload their own avatar
  async uploadAvatar(req, res) {
    try {
      const userId = req.user.userId; // ✅ from JWT

      const avatarUrl = await profileService.uploadAvatar(userId, req.file);
      res.status(200).json({ message: 'Avatar uploaded successfully', avatarUrl });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to upload avatar' });
    }
  },
};

export default ProfileController;

