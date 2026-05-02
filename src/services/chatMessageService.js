import prisma from '../lib/prisma.js';

const ChatMessageService = {

  async createMessage({ roomId, userId, message }) {
    const room = await prisma.chatRoom.findUnique({ where: { id: parseInt(roomId) } });
    if (!room) {
      const error = new Error('Chat room not found');
      error.statusCode = 404;
      throw error;
    }

    return prisma.chatMessage.create({
      data: {
        roomId: parseInt(roomId),
        userId: parseInt(userId),
        message,
      },
      include: {
        user: { select: { id: true, fullname: true, email: true } },
        room: { select: { id: true, name: true } },
      },
    });
  },

  async getMessages({ roomId, page = 1, limit = 20 }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = roomId ? { roomId: parseInt(roomId) } : {};

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where,
        skip,
        take,
        orderBy: { sentAt: 'asc' },
        include: {
          user: { select: { id: true, fullname: true, email: true } },
          room: { select: { id: true, name: true } },
        },
      }),
      prisma.chatMessage.count({ where }),
    ]);

    return {
      data: messages,
      meta: {
        total,
        page: parseInt(page),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  },

  async getMessageById(id) {
    const message = await prisma.chatMessage.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullname: true, email: true } },
        room: { select: { id: true, name: true } },
      },
    });

    if (!message) {
      const error = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }

    return message;
  },

  async updateMessage(id, { message }) {
    const existing = await prisma.chatMessage.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }

    return prisma.chatMessage.update({
      where: { id },
      data: { message },
      include: {
        user: { select: { id: true, fullname: true, email: true } },
        room: { select: { id: true, name: true } },
      },
    });
  },

  async deleteMessage(id) {
    const existing = await prisma.chatMessage.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }

    await prisma.chatMessage.delete({ where: { id } });
  },
};

export default ChatMessageService;