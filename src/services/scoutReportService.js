import prisma from '../lib/prisma.js';

const scoutReportService = {

  async create(data) {
    const { scoutId, playerId, timesSeen, keyStrengths, areasForDevelopment, recommendation, ...rest } = data;

    const scout = await prisma.user.findUnique({ where: { id: parseInt(scoutId) } });
    if (!scout || scout.role !== 'SCOUT') {
      throw { status: 403, message: 'Only scouts can file reports' };
    }

    const player = await prisma.user.findUnique({ where: { id: parseInt(playerId) } });
    if (!player || player.role !== 'PLAYER') {
      throw { status: 404, message: 'Player not found' };
    }

    return prisma.scoutReport.create({
      data: {
        scoutId: parseInt(scoutId),
        playerId: parseInt(playerId),
        timesSeen: timesSeen ? parseInt(timesSeen) : null,
        keyStrengths: keyStrengths ?? [],
        areasForDevelopment: areasForDevelopment ?? [],
        recommendation: recommendation ?? null,
        ...rest,
      },
      include: {
        scout: { select: { id: true, fullname: true, email: true } },
        player: {
          select: {
            id: true, fullname: true, email: true,
            profile: { select: { position: true, height: true, dob: true, country: true, city: true } },
          },
        },
      },
    });
  },

  async getAll({ scoutId, playerId, recommendation, page = 1, limit = 10 }) {
    const where = {};
    if (scoutId) where.scoutId = parseInt(scoutId);
    if (playerId) where.playerId = parseInt(playerId);
    if (recommendation) where.recommendation = recommendation;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [reports, total] = await Promise.all([
      prisma.scoutReport.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          scout: { select: { id: true, fullname: true, email: true } },
          player: {
            select: {
              id: true, fullname: true, email: true,
              profile: { select: { position: true, height: true, dob: true, country: true, city: true } },
            },
          },
        },
      }),
      prisma.scoutReport.count({ where }),
    ]);

    return {
      data: reports,
      meta: { total, page: parseInt(page), limit: take, totalPages: Math.ceil(total / take) },
    };
  },

  async getById(id) {
    const report = await prisma.scoutReport.findUnique({
      where: { id },
      include: {
        scout: { select: { id: true, fullname: true, email: true } },
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

  async update(id, requestingScoutId, data) {
    const existing = await prisma.scoutReport.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: 'Report not found' };
    if (existing.scoutId !== parseInt(requestingScoutId)) {
      throw { status: 403, message: 'You can only update your own reports' };
    }

    const { timesSeen, ...rest } = data;

    return prisma.scoutReport.update({
      where: { id },
      data: {
        ...rest,
        timesSeen: timesSeen ? parseInt(timesSeen) : undefined,
      },
    });
  },

  async delete(id) {
    const existing = await prisma.scoutReport.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: 'Report not found' };
    await prisma.scoutReport.delete({ where: { id } });
  },
};

export default scoutReportService;