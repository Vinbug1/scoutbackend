import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// const prisma = new PrismaClient();

const PlayerReportController = {
  // Create a new PlayerReport
  async create(req, res) {
    try {
      const { playerId, data } = req.body;
      if (!playerId || !data) {
        return res.status(400).json({ error: "playerId and data are required" });
      }
      const newReport = await prisma.playerReport.create({
        data: {
          playerId,
          data,
        },
      });
      res.status(201).json(newReport);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create player report" });
    }
  },

  // Get all PlayerReports
  async getAll(req, res) {
    try {
      const reports = await prisma.playerReport.findMany({
        include: { player: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json(reports);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch player reports" });
    }
  },

  // Get a single PlayerReport by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const report = await prisma.playerReport.findUnique({
        where: { id: parseInt(id) },
        include: { player: true },
      });
      if (!report) {
        return res.status(404).json({ error: "Player report not found" });
      }
      res.json(report);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch player report" });
    }
  },

  // Update a PlayerReport by ID
  async update(req, res) {
    try {
      const { id } = req.params;
      const { data } = req.body;
      const updatedReport = await prisma.playerReport.update({
        where: { id: parseInt(id) },
        data: { data },
      });
      res.json(updatedReport);
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: "Player report not found" });
      }
      res.status(500).json({ error: "Failed to update player report" });
    }
  },

  // Delete a PlayerReport by ID
  async delete(req, res) {
    try {
      const { id } = req.params;
      await prisma.playerReport.delete({
        where: { id: parseInt(id) },
      });
      res.json({ message: "Player report deleted successfully" });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: "Player report not found" });
      }
      res.status(500).json({ error: "Failed to delete player report" });
    }
  }
};

export default PlayerReportController;