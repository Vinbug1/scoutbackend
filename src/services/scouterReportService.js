import prisma from '../lib/prisma.js';

const scouterReportService = {

  async create(data) {
    const { scouterId, playerId, timesSeen, keyStrengths, areasForDevelopment, recommendation, ...rest } = data;

    const scouter = await prisma.user.findUnique({ where: { id: parseInt(scouterId) } });
    if (!scouter || scouter.role !== 'SCOUT') {
      throw { status: 403, message: 'Only scouts can file reports' };
    }

    const player = await prisma.user.findUnique({ where: { id: parseInt(playerId) } });
    if (!player || player.role !== 'PLAYER') {
      throw { status: 404, message: 'Player not found' };
    }

    return prisma.scouterReport.create({
      data: {
        scouterId: parseInt(scouterId),
        playerId: parseInt(playerId),
        timesSeen: timesSeen ? parseInt(timesSeen) : null,
        keyStrengths: keyStrengths ?? [],
        areasForDevelopment: areasForDevelopment ?? [],
        recommendation: recommendation ?? null,
        ...rest,
      },
      include: {
        scouter: { select: { id: true, fullname: true, email: true } },
        player: {
          select: {
            id: true, fullname: true, email: true,
            profile: { select: { position: true, height: true, dob: true, country: true, city: true } },
          },
        },
      },
    });
  },

  async getAll({ scouterId, playerId, recommendation, page = 1, limit = 10 }) {
    const where = {};
    if (scouterId) where.scouterId = parseInt(scouterId);
    if (playerId) where.playerId = parseInt(playerId);
    if (recommendation) where.recommendation = recommendation;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [reports, total] = await Promise.all([
      prisma.scouterReport.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          scouter: { select: { id: true, fullname: true, email: true } },
          player: {
            select: {
              id: true, fullname: true, email: true,
              profile: { select: { position: true, height: true, dob: true, country: true, city: true } },
            },
          },
        },
      }),
      prisma.scouterReport.count({ where }),
    ]);

    return {
      data: reports,
      meta: { total, page: parseInt(page), limit: take, totalPages: Math.ceil(total / take) },
    };
  },

  async getById(id) {
    const report = await prisma.scouterReport.findUnique({
      where: { id },
      include: {
        scouter: { select: { id: true, fullname: true, email: true } },
        player: {
          select: {
            id: true, fullname: true, email: true,
            profile: { select: { position: true, height: true, dob: true, country: true, city: true } },
          },
        },
      },
    });

    if (!report) throw { status: 404, message: 'Report not found' };
    return report;
  },

  async update(id, requestingScouterId, data) {
    const existing = await prisma.scouterReport.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: 'Report not found' };
    if (existing.scouterId !== parseInt(requestingScouterId)) {
      throw { status: 403, message: 'You can only update your own reports' };
    }

    const { timesSeen, ...rest } = data;

    return prisma.scouterReport.update({
      where: { id },
      data: {
        ...rest,
        timesSeen: timesSeen ? parseInt(timesSeen) : undefined,
      },
    });
  },

  async delete(id) {
    const existing = await prisma.scouterReport.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: 'Report not found' };
    await prisma.scouterReport.delete({ where: { id } });
  },
};

export default scouterReportService;