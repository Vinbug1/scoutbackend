import prisma from '../lib/prisma.js';
import { uploadMediaToGCS } from '../config/multer.js';
import { Storage } from '@google-cloud/storage';

// ✅ bucket instance for old avatar cleanup
const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

const profileService = {

  // =========================
  // GET ALL
  // =========================
  async getAll({ page = 1, limit = 10, position, country, gender, search }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};
    if (position) where.position = position;
    if (country) where.country = country;
    if (gender) where.gender = gender;

    if (search) {
      where.user = {
        fullname: { contains: search, mode: 'insensitive' },
      };
    }

    const [profiles, total] = await Promise.all([
      prisma.profile.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, position: true, height: true, favouriteFoot: true,
          strengths: true, gender: true, country: true, city: true,
          dob: true, bio: true, avatarUrl: true, createdAt: true,
          user: { select: { id: true, fullname: true } }, // ✅ removed email for privacy
        },
      }),
      prisma.profile.count({ where }),
    ]);

    return {
      data: profiles,
      meta: {
        total,
        page: parseInt(page),
        limit: take,
        totalPages: Math.ceil(total / take),
        hasNextPage: skip + take < total,
        hasPrevPage: parseInt(page) > 1,
      },
    };
  },

  // =========================
  // GET BY USER ID
  // =========================
  async getById(userId) {
    const profile = await prisma.profile.findUnique({
      where: { userId }, // ✅ userId
      select: {
        id: true, position: true, height: true, favouriteFoot: true,
        strengths: true, gender: true, country: true, city: true,
        dob: true, bio: true, avatarUrl: true, createdAt: true,
        user: { select: { id: true, fullname: true, email: true } },
      },
    });

    if (!profile) throw { status: 404, message: 'Profile not found' };
    return profile;
  },

  // =========================
  // UPDATE
  // =========================
  async update(userId, { position, height, favouriteFoot, strengths, gender, country, city, dob, bio }) {
    const existing = await prisma.profile.findUnique({ where: { userId } }); // ✅ userId
    if (!existing) throw { status: 404, message: 'Profile not found' };

    return prisma.profile.update({
      where: { userId }, // ✅ userId
      data: {
        position,
        height: height ? parseFloat(height) : undefined,
        favouriteFoot,
        strengths,
        gender,
        country,
        city,
        dob: dob ? new Date(dob) : undefined,
        bio,
      },
    });
  },

  // =========================
  // DELETE
  // =========================
  async delete(userId) {
    const existing = await prisma.profile.findUnique({ where: { userId } }); // ✅ userId
    if (!existing) throw { status: 404, message: 'Profile not found' };
    await prisma.profile.delete({ where: { userId } }); // ✅ userId
  },

  // =========================
  // UPLOAD AVATAR
  // =========================
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
      throw { status: 404, message: 'Player profile not found' };
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

export default profileService;

