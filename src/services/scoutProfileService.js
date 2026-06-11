import { Storage } from '@google-cloud/storage';
import prisma from '../lib/prisma.js';
import { uploadMediaToGCS } from '../config/multer.js';

// ✅ bucket instance for old avatar cleanup
const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

const scoutProfileService = {

  // =========================
  // GET ALL
  // =========================
  async getAll({ page = 1, limit = 10, country, search }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};
    if (country) where.country = country;

    if (search) {
      where.user = {
        fullname: { contains: search, mode: 'insensitive' },
      };
    }

    const [profiles, total] = await Promise.all([
      prisma.scoutProfile.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, club: true, country: true, city: true,
          address: true, bio: true, avatarUrl: true, createdAt: true,
          user: { select: { id: true, fullname: true } },
        },
      }),
      prisma.scoutProfile.count({ where }),
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
    const profile = await prisma.scoutProfile.findUnique({
      where: { userId },
      select: {
        id: true, club: true, country: true, city: true,
        address: true, bio: true, avatarUrl: true, createdAt: true,
        user: { select: { id: true, fullname: true, email: true } },
      },
    });

    if (!profile) throw { status: 404, message: 'Scout profile not found' };
    return profile;
  },

  // =========================
  // UPDATE
  // =========================
  async update(userId, { club, country, city, address, bio }) {
    const existing = await prisma.scoutProfile.findUnique({ where: { userId } });
    if (!existing) throw { status: 404, message: 'Scout profile not found' };

    return prisma.scoutProfile.update({
      where: { userId },
      data: { club, country, city, address, bio },
    });
  },

  // =========================
  // DELETE
  // =========================
  async delete(userId) {
    const existing = await prisma.scoutProfile.findUnique({ where: { userId } });
    if (!existing) throw { status: 404, message: 'Scout profile not found' };
    await prisma.scoutProfile.delete({ where: { userId } });
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
    const existing = await prisma.scoutProfile.findUnique({ where: { userId } });
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
    const updated = await prisma.scoutProfile.update({
      where: { userId },
      data: { avatarUrl: uploaded.url },
    });

    return {
      message: 'Avatar uploaded successfully',
      avatarUrl: updated.avatarUrl,
    };
  },
};

export default scoutProfileService;



