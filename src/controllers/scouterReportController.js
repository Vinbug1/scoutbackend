import prisma from '../lib/prisma.js';  // or '../config/prisma.js'
// const prisma = new PrismaClient();

const scouterReportController = {
  // CREATE a new ScouterReport
async create(req, res) {
  try {
    const { scouterId, playerId, title, report } = req.body;

    // 👇 Guard: make sure both users exist
    if (!scouterId || !playerId || !report) {
      return res.status(400).json({ error: 'scouterId, playerId and report are required' });
    }

    const newReport = await prisma.scouterReport.create({
      data: {
        scouterId: parseInt(scouterId),
        playerId: parseInt(playerId),
        title,
        report,
      },
      include: {
        scouter: { select: { id: true, fullname: true, email: true } },
        player: { select: { id: true, fullname: true, email: true } },
      }
    });

    res.status(201).json({ message: 'Report created successfully', data: newReport });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create report' });
  }
},

// GET ALL ScouterReports
async getAll(req, res) {
  try {
    const { scouterId, playerId, page = 1, limit = 10 } = req.query;

    const where = {};
    if (scouterId) where.scouterId = parseInt(scouterId);
    if (playerId) where.playerId = parseInt(playerId);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [reports, total] = await Promise.all([
      prisma.scouterReport.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          scouter: { select: { id: true, fullname: true, email: true } },
          player: { select: { id: true, fullname: true, email: true } },
        },
      }),
      prisma.scouterReport.count({ where }),
    ]);

    res.status(200).json({
      data: reports,
      meta: {
        total,
        page: parseInt(page),
        limit: take,
        totalPages: Math.ceil(total / take),
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
},

// GET a single ScouterReport by ID
async getById(req, res) {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

    const report = await prisma.scouterReport.findUnique({
      where: { id },
      include: {
        scouter: { select: { id: true, fullname: true, email: true } },
        player: { select: { id: true, fullname: true, email: true } },
      },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.status(200).json({ data: report });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
},

// UPDATE a ScouterReport
async update(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { title, report } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

    // 👇 Guard: check report exists before updating
    const existing = await prisma.scouterReport.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const updatedReport = await prisma.scouterReport.update({
      where: { id },
      data: { title, report },
    });

    res.status(200).json({ message: 'Report updated successfully', data: updatedReport });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update report' });
  }
},

// DELETE a ScouterReport
async delete(req, res) {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

    // 👇 Guard: check report exists before deleting
    const existing = await prisma.scouterReport.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await prisma.scouterReport.delete({ where: { id } });
    res.status(200).json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
}
};

export default scouterReportController;