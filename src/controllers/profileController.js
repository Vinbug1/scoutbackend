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
  async uploadAvatar(userId, file) {
    if (!file) {
      throw { status: 400, message: 'No image file provided' };
    }

    // avatars must be images only
    if (!file.mimetype?.startsWith('image/')) {
      throw { status: 400, message: 'Avatar must be an image' };
    }

    // check profile exists
    const existing = await prisma.profile.findUnique({ where: { userId } });
    if (!existing) {
      throw { status: 404, message: 'Scout profile not found' };
    }

    // ✅ upload new avatar to GCS
    // file is a diskStorage object — has .path and .mimetype, which uploadMediaToGCS expects
    const uploaded = await uploadMediaToGCS(file, 'avatars');

    // ✅ delete old avatar from GCS to avoid storage leaks
    if (existing.avatarUrl) {
      try {
        const oldPath = existing.avatarUrl.split('.com/')[1];
        if (oldPath) {
          await bucket.file(oldPath).delete().catch(() => {});
        }
      } catch (_) {
        // non-critical — log and continue
      }
    }

    // update DB with new avatar URL
    const updated = await prisma.profile.update({
      where: { userId },
      data: { avatarUrl: uploaded.url },
    });

    return {
      message: 'Avatar uploaded successfully',
      avatarUrl: updated.avatarUrl,
    };
  },
};

export default ProfileController;

