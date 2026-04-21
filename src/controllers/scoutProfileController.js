import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
import { uploadMediaToGCS } from '../config/multer.js'
// const prisma = new PrismaClient();

const ScoutProfileController = {
  // =========================
  // CREATE PROFILE
  // =========================
  async createScoutProfile(req, res) {
    try {
      const {
        userId,
        country,
        city,
        address,
        bio
      } = req.body;

      const profile = await prisma.profile.create({
        data: {
          userId,
          country,
          city,
          address,
          bio
        }
      });

      res.status(201).json({
        message: "Profile created successfully",
        data: profile
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // =========================
  // GET ALL PROFILES
  // =========================
  async getScoutProfiles(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        position,
        country,
        gender,
        search
      } = req.query;
  
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);
  
      // Build dynamic filters
      const where = {};
  
      if (position) where.position = position;
      if (country) where.country = country;
      if (gender) where.gender = gender;
  
      // Search by name via related user
      if (search) {
        where.user = {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName:  { contains: search, mode: 'insensitive' } },
          ]
        };
      }
  
      const [profiles, total] = await Promise.all([
        prisma.profile.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            position: true,
            height: true,
            favouriteFoot: true,
            strengths: true,
            gender: true,
            country: true,
            city: true,
            dob: true,
            bio: true,
            avatarUrl: true,       // 👈 image included
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,        // remove if sensitive
              }
            }
          }
        }),
        prisma.profile.count({ where })
      ]);
  
      res.status(200).json({
        data: profiles,
        meta: {
          total,
          page: parseInt(page),
          limit: take,
          totalPages: Math.ceil(total / take),
          hasNextPage: skip + take < total,
          hasPrevPage: parseInt(page) > 1,
        }
      });
  
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // =========================
  // GET PROFILE BY ID
  // =========================
  async getScoutProfileById(req, res) {
    try {
      const id = parseInt(req.params.id);
  
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid profile ID' });
      }
  
      const profile = await prisma.profile.findUnique({
        where: { id },
        select: {
          id: true,
          position: true,
          height: true,
          favouriteFoot: true,
          strengths: true,
          gender: true,
          country: true,
          city: true,
          dob: true,
          bio: true,
          avatarUrl: true,         // 👈 image included
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            }
          }
        }
      });
  
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
  
      res.status(200).json({ data: profile });
  
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // =========================
  // UPDATE PROFILE
  // =========================
  async updateScoutProfile(req, res) {
    try {
      const id = parseInt(req.params.id);
      const {
        country,
        city,
        address,
        bio
      } = req.body;

      const profile = await prisma.profile.update({
        where: { id },
        data: {
          country,
          city,
          address,
          bio
        }
      });

      res.status(200).json({
        message: "Profile updated successfully",
        data: profile
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // =========================
  // DELETE PROFILE
  // =========================
  async deleteScoutProfile(req, res) {
    try {
      const id = parseInt(req.params.id);
      await prisma.profile.delete({
        where: { id }
      });
      res.status(200).json({ message: "Profile deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },


  async uploadAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }
  
      const userId = req.user.id;
  
      // 👇 Guard: make sure profile exists first
      const existing = await prisma.profile.findUnique({ where: { userId } });
      if (!existing) {
        return res.status(404).json({ error: 'Profile not found. Create a profile first.' });
      }
  
      const uploaded = await uploadMediaToGCS(req.file, 'avatars');
  
      const profile = await prisma.profile.update({
        where: { userId },
        data: { avatarUrl: uploaded.url },
      });
  
      res.status(200).json({
        message: 'Avatar uploaded successfully',
        avatarUrl: profile.avatarUrl,
      });
  
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  async uploadAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }
  
      const userId = req.user.id;
  
      // 👇 Guard: make sure profile exists first
      const existing = await prisma.profile.findUnique({ where: { userId } });
      if (!existing) {
        return res.status(404).json({ error: 'Profile not found. Create a profile first.' });
      }
  
      const uploaded = await uploadMediaToGCS(req.file, 'avatars');
  
      const profile = await prisma.profile.update({
        where: { userId },
        data: { avatarUrl: uploaded.url },
      });
  
      res.status(200).json({
        message: 'Avatar uploaded successfully',
        avatarUrl: profile.avatarUrl,
      });
  
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  
};

export default ScoutProfileController;