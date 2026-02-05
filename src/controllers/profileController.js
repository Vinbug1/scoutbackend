import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// const prisma = new PrismaClient();

const ProfileController = {
  // =========================
  // CREATE PROFILE
  // =========================
  async createProfile(req, res) {
    try {
      const {
        userId,
        position,
        height,
        favouriteFoot,
        strengths,
        gender,
        country,
        city,
        dob,
        bio
      } = req.body;

      const profile = await prisma.profile.create({
        data: {
          userId,
          position,
          height,
          favouriteFoot,
          strengths,
          gender,
          country,
          city,
          dob: dob ? new Date(dob) : null,
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
  async getProfiles(req, res) {
    try {
      const profiles = await prisma.profile.findMany({
        include: { user: true }
      });
      res.status(200).json(profiles);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // =========================
  // GET PROFILE BY ID
  // =========================
  async getProfileById(req, res) {
    try {
      const id = parseInt(req.params.id);
      const profile = await prisma.profile.findUnique({
        where: { id },
        include: { user: true }
      });

      if (!profile)
        return res.status(404).json({ error: "Profile not found" });

      res.status(200).json(profile);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // =========================
  // UPDATE PROFILE
  // =========================
  async updateProfile(req, res) {
    try {
      const id = parseInt(req.params.id);
      const {
        position,
        height,
        favouriteFoot,
        strengths,
        gender,
        country,
        city,
        dob,
        bio
      } = req.body;

      const profile = await prisma.profile.update({
        where: { id },
        data: {
          position,
          height,
          favouriteFoot,
          strengths,
          gender,
          country,
          city,
          dob: dob ? new Date(dob) : null,
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
  async deleteProfile(req, res) {
    try {
      const id = parseInt(req.params.id);
      await prisma.profile.delete({
        where: { id }
      });
      res.status(200).json({ message: "Profile deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

export default ProfileController;