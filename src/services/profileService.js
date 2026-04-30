import prisma from '../lib/prisma.js';
import { uploadMediaToGCS } from '../config/multer.js';

const profileService = {

  // =========================
  // CREATE
  // =========================
  async create({ userId, position, height, favouriteFoot, strengths, gender, country, city, dob, bio }) {
    if (!userId) throw { status: 400, message: 'userId is required' };

    const userExists = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    if (!userExists) throw { status: 404, message: 'User not found' };

    const alreadyExists = await prisma.profile.findUnique({ where: { userId: parseInt(userId) } });
    if (alreadyExists) throw { status: 400, message: 'Profile already exists for this user' };

    return prisma.profile.create({
      data: {
        userId: parseInt(userId),
        position,
        height: height ? parseFloat(height) : null,
        favouriteFoot,
        strengths,
        gender,
        country,
        city,
        dob: dob ? new Date(dob) : null,
        bio,
      },
    });
  },

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

    // ✅ Fixed: User model has `fullname`, not firstName/lastName
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
          user: { select: { id: true, fullname: true, email: true } }, // ✅ fixed
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
  // GET BY ID
  // =========================
  async getById(id) {
    const profile = await prisma.profile.findUnique({
      where: { id },
      select: {
        id: true, position: true, height: true, favouriteFoot: true,
        strengths: true, gender: true, country: true, city: true,
        dob: true, bio: true, avatarUrl: true, createdAt: true,
        user: { select: { id: true, fullname: true, email: true } }, // ✅ fixed
      },
    });

    if (!profile) throw { status: 404, message: 'Profile not found' };
    return profile;
  },

  // =========================
  // UPDATE
  // =========================
  async update(id, { position, height, favouriteFoot, strengths, gender, country, city, dob, bio }) {
    const existing = await prisma.profile.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: 'Profile not found' };

    return prisma.profile.update({
      where: { id },
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
  async delete(id) {
    const existing = await prisma.profile.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: 'Profile not found' };
    await prisma.profile.delete({ where: { id } });
  },

  // =========================
  // UPLOAD AVATAR
  // =========================
  async uploadAvatar(userId, file) {
    if (!file) throw { status: 400, message: 'No image file provided' };

    const existing = await prisma.profile.findUnique({ where: { userId } });
    if (!existing) throw { status: 404, message: 'Profile not found. Create a profile first.' };

    const uploaded = await uploadMediaToGCS(file, 'avatars');

    const profile = await prisma.profile.update({
      where: { userId },
      data: { avatarUrl: uploaded.url },
    });

    return profile.avatarUrl;
  },
};

export default profileService;