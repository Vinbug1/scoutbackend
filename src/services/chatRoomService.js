import prisma from '../lib/prisma.js';

const chatRoomService = {

  async create({ name, userIds = [] }) {
    return prisma.chatRoom.create({
      data: {
        name: name || null,
        members: userIds.length > 0 ? {
          create: userIds.map(userId => ({ userId }))
        } : undefined,
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, fullname: true, email: true } }
          }
        }
      }
    });
  },

  async getAll({ page = 1, limit = 10 }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [chatRooms, total] = await Promise.all([
      prisma.chatRoom.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          members: {
            include: {
              user: { select: { id: true, fullname: true, email: true } }
            }
          },
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            include: {
              user: { select: { id: true, fullname: true } }
            }
          },
          _count: { select: { messages: true, members: true } }
        },
      }),
      prisma.chatRoom.count()
    ]);

    return {
      data: chatRooms,
      meta: {
        total,
        page: parseInt(page),
        limit: take,
        totalPages: Math.ceil(total / take),
      }
    };
  },

  async getById(id) {
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, fullname: true, email: true } }
          }
        },
        messages: {
          orderBy: { sentAt: 'asc' },
          include: {
            user: { select: { id: true, fullname: true } }
          }
        },
        _count: { select: { messages: true, members: true } }
      },
    });

    if (!chatRoom) {
      const error = new Error('Chat room not found');
      error.statusCode = 404;
      throw error;
    }

    return chatRoom;
  },

  async update(id, { name }) {
    const existing = await prisma.chatRoom.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error('Chat room not found');
      error.statusCode = 404;
      throw error;
    }

    return prisma.chatRoom.update({
      where: { id },
      data: { name },
    });
  },

  async delete(id) {
    const existing = await prisma.chatRoom.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error('Chat room not found');
      error.statusCode = 404;
      throw error;
    }

    // Delete messages and members first to avoid FK constraint errors
    await prisma.$transaction([
      prisma.chatMessage.deleteMany({ where: { roomId: id } }),
      prisma.chatRoomMember.deleteMany({ where: { roomId: id } }),
      prisma.chatRoom.delete({ where: { id } }),
    ]);
  },

  async addMember(roomId, { userId }) {
    return prisma.chatRoomMember.create({
      data: { roomId, userId },
      include: {
        user: { select: { id: true, fullname: true, email: true } }
      }
    });
  },

  async removeMember(roomId, userId) {
    return prisma.chatRoomMember.delete({
      where: { roomId_userId: { roomId, userId } }
    });
  }
};

export default chatRoomService;