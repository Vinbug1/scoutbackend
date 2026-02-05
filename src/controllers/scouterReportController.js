import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// const prisma = new PrismaClient();

const scouterReportController = {
  // CREATE a new ScouterReport
  async create(req, res) {
    try {
      const { scouterId, playerId, title, report } = req.body;
      const newReport = await prisma.scouterReport.create({
        data: {
          scouterId,
          playerId,
          title,
          report,
        },
      });
      res.status(201).json(newReport);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create report' });
    }
  },

  // GET ALL ScouterReports
  async getAll(req, res) {
    try {
      const reports = await prisma.scouterReport.findMany({
        include: {
          scouter: true,
          player: true,
        },
      });
      res.status(200).json(reports);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  },

  // GET a single ScouterReport by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const report = await prisma.scouterReport.findUnique({
        where: { id: parseInt(id) },
        include: {
          scouter: true,
          player: true,
        },
      });
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      res.status(200).json(report);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch report' });
    }
  },

  // UPDATE a ScouterReport
  async update(req, res) {
    try {
      const { id } = req.params;
      const { title, report } = req.body;
      const updatedReport = await prisma.scouterReport.update({
        where: { id: parseInt(id) },
        data: {
          title,
          report,
        },
      });
      res.status(200).json(updatedReport);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update report' });
    }
  },

  // DELETE a ScouterReport
  async delete(req, res) {
    try {
      const { id } = req.params;
      await prisma.scouterReport.delete({
        where: { id: parseInt(id) },
      });
      res.status(200).json({ message: 'Report deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete report' });
    }
  }
};

export default scouterReportController;