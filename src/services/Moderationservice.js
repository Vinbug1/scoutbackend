import prisma from '../lib/prisma.js';

const ModerationService = {

  async blockUser({ blockerId, blockedId }) {
    blockerId = parseInt(blockerId);
    blockedId = parseInt(blockedId);

    if (blockerId === blockedId) {
      const error = new Error('Cannot block yourself');
      error.statusCode = 400;
      throw error;
    }

    const target = await prisma.user.findUnique({ where: { id: blockedId } });
    if (!target) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    return prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });
  },

  async unblockUser({ blockerId, blockedId }) {
    await prisma.block.deleteMany({
      where: { blockerId: parseInt(blockerId), blockedId: parseInt(blockedId) },
    });
    return { unblocked: true };
  },

  async listBlocked(blockerId) {
    return prisma.block.findMany({
      where: { blockerId: parseInt(blockerId) },
      include: { blocked: { select: { id: true, fullname: true, email: true } } },
    });
  },

  async reportUser({ reporterId, reportedId, reason, messageId }) {
    reporterId = parseInt(reporterId);
    reportedId = parseInt(reportedId);

    if (reporterId === reportedId) {
      const error = new Error('Cannot report yourself');
      error.statusCode = 400;
      throw error;
    }
    if (!reason?.trim()) {
      const error = new Error('A reason is required');
      error.statusCode = 400;
      throw error;
    }

    const target = await prisma.user.findUnique({ where: { id: reportedId } });
    if (!target) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    return prisma.report.create({
      data: { reporterId, reportedId, reason: reason.trim(), messageId: messageId ? parseInt(messageId) : undefined },
    });
  },
};

export default ModerationService;