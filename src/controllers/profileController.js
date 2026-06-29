import profileService from '../services/profileService.js';
import fs from 'fs';

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
      const userId = req.user.id ?? req.user.userId; // ✅ handle both
      
      console.log('🔍 uploadAvatar userId:', userId, 'user:', req.user); // temp debug
      
      const result = await scoutProfileService.uploadAvatar(userId, req.file);
      res.status(200).json(result);
    } catch (err) {
      console.error('❌ uploadAvatar error:', err); // ✅ add this so you can see what's failing
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to upload avatar' });
    } finally {
      if (req.file?.path) {
        fs.unlink(req.file.path, () => {});
      }
    }
  },
//   async uploadAvatar(req, res) {
//     try {
//       const userId = req.user.userId;

//       // req.file now comes from diskStorage — has .path, not .buffer
//       const result = await profileService.uploadAvatar(userId, req.file);
//       res.status(200).json(result);
//     } catch (err) {
//       res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to upload avatar' });
//     } finally {
//       // ✅ Always clean up the temp disk file multer wrote, regardless of success/failure
//       if (req.file?.path) {
//         fs.unlink(req.file.path, () => {});
//       }
//     }
//   },
 };

export default ProfileController;

