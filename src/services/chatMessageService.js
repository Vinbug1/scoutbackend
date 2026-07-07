import prisma from '../lib/prisma.js';

const ChatMessageService = {

  async createMessage({ roomId, userId, text, type = 'TEXT', mediaUrl, thumbnailUrl, fileName, fileSize, durationSec, replyToId, clientTempId }) {
    roomId = parseInt(roomId);
    userId = parseInt(userId);

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { members: true },
    });
    if (!room) {
      const error = new Error('Chat room not found');
      error.statusCode = 404;
      throw error;
    }

    const isMember = room.members.some(m => m.userId === userId);
    if (!isMember) {
      const error = new Error('You are not a member of this room');
      error.statusCode = 403;
      throw error;
    }

    // Block check — only meaningful for 1:1 rooms, but harmless for group rooms too
    const otherMembers = room.members.filter(m => m.userId !== userId);
    for (const other of otherMembers) {
      const blocked = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: other.userId },
            { blockerId: other.userId, blockedId: userId },
          ],
        },
      });
      if (blocked) {
        const error = new Error('Cannot send messages to this user');
        error.statusCode = 403;
        throw error;
      }
    }

    if (type === 'TEXT' && !text?.trim()) {
      const error = new Error('Message content is required for text messages');
      error.statusCode = 400;
      throw error;
    }
    if (type !== 'TEXT' && !mediaUrl) {
      const error = new Error('mediaUrl is required for media messages');
      error.statusCode = 400;
      throw error;
    }

    const newMessage = await prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          roomId,
          userId,
          text,
          type,
          mediaUrl,
          thumbnailUrl,
          fileName,
          fileSize,
          durationSec,
          replyToId: replyToId ? parseInt(replyToId) : undefined,
          clientTempId,
        },
        include: {
          user: { select: { id: true, fullname: true, email: true } },
          room: { select: { id: true, name: true } },
          replyTo: { select: { id: true, text: true, type: true, userId: true } },
        },
      });

      await tx.chatRoom.update({
        where: { id: roomId },
        data: { lastMessageId: created.id },
      });

      await tx.chatRoomMember.updateMany({
        where: { roomId, userId: { not: userId } },
        data: { unreadCount: { increment: 1 } },
      });

      return created;
    });

    return newMessage;
  },

  async getMessages({ roomId, page = 1, limit = 20 }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = { deletedAt: null, ...(roomId ? { roomId: parseInt(roomId) } : {}) };

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where,
        skip,
        take,
        orderBy: { sentAt: 'asc' },
        include: {
          user: { select: { id: true, fullname: true, email: true } },
          room: { select: { id: true, name: true } },
          reads: true,
          replyTo: { select: { id: true, text: true, type: true, userId: true } },
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

  // Cursor-based pagination for infinite scroll — use this instead of
  // getMessages() once history grows; OFFSET pagination gets slow over time.
  async getMessagesByCursor({ roomId, cursor, limit = 30 }) {
    roomId = parseInt(roomId);
    limit = parseInt(limit);

    const messages = await prisma.chatMessage.findMany({
      where: {
        roomId,
        deletedAt: null,
        ...(cursor ? { id: { lt: parseInt(cursor) } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, fullname: true, email: true } },
        reads: true,
        replyTo: { select: { id: true, text: true, type: true, userId: true } },
      },
    });

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;

    return { data: messages.reverse(), nextCursor };
  },

  async getMessageById(id) {
    const message = await prisma.chatMessage.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullname: true, email: true } },
        room: { select: { id: true, name: true } },
        reads: true,
      },
    });

    if (!message || message.deletedAt) {
      const error = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }

    return message;
  },

  async updateMessage(id, userId, { text }) {

      const existing = await prisma.chatMessage.findUnique({
          where: { id }
      });

      if (!existing || existing.deletedAt) {
          const error = new Error("Message not found");
          error.statusCode = 404;
          throw error;
      }

      if (existing.userId !== userId) {
          const error = new Error("You can only edit your own messages");
          error.statusCode = 403;
          throw error;
      }

      if (existing.type !== "TEXT") {
          const error = new Error("Only text messages can be edited");
          error.statusCode = 400;
          throw error;
      }

      if (!text?.trim()) {
        const error = new Error("Message text is required");
        error.statusCode = 400;
        throw error;
    }

      return prisma.chatMessage.update({
          where: { id },
          data: {
              text
          },
          include: {
              user: {
                  select: {
                      id: true,
                      fullname: true,
                      email: true
                  }
              },
              room: {
                  select: {
                      id: true,
                      name: true
                  }
              }
          }
      });

  },

  // Soft delete — keeps the row (so "message deleted" placeholders render
  // correctly in history) instead of hard-removing it.
  async deleteMessage(id, userId) {
      const existing = await prisma.chatMessage.findUnique({
        where: { id }
    });

    if (!existing || existing.deletedAt) {
        const error = new Error("Message not found");
        error.statusCode = 404;
        throw error;
    }

    if (existing.userId !== userId) {
        const error = new Error("You can only delete your own messages");
        error.statusCode = 403;
        throw error;
    }

    await prisma.chatMessage.update({
        where: { id },
        data: {
            deletedAt: new Date(),
            text: null,
            mediaUrl: null,
            thumbnailUrl: null,
            fileName: null
        }
    });
  },

  // Called when a recipient's client acknowledges receipt over the socket
  // (message reached the device, not necessarily read yet). Only bumps
  // status SENT -> DELIVERED; never downgrades an already-READ message.
  async markDelivered({ roomId, userId, messageIds }) {
    roomId = parseInt(roomId);
    userId = parseInt(userId);

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return { updated: 0 };
    }

    const result = await prisma.chatMessage.updateMany({
      where: {
        id: { in: messageIds.map(id => parseInt(id)) },
        roomId,
        userId: { not: userId }, // can't "deliver" your own sent messages to yourself
        status: 'SENT',
        deletedAt: null,
      },
      data: { status: 'DELIVERED' },
    });

    return { updated: result.count };
  },

  // Mark every unread message in a room (up to upToMessageId) as read by userId.
  async markRead({ roomId, userId, upToMessageId }) {
    roomId = parseInt(roomId);
    userId = parseInt(userId);
    upToMessageId = parseInt(upToMessageId);

    const unread = await prisma.chatMessage.findMany({
      where: {
        roomId,
        id: { lte: upToMessageId },
        userId: { not: userId },
        deletedAt: null,
        reads: { none: { userId } },
      },
      select: { id: true },
    });

    if (unread.length === 0) return { updated: 0 };

    await prisma.$transaction([
      prisma.messageRead.createMany({
        data: unread.map(m => ({ messageId: m.id, userId })),
        skipDuplicates: true,
      }),
      prisma.chatMessage.updateMany({
        where: { id: { in: unread.map(m => m.id) } },
        data: { status: 'READ' },
      }),
      prisma.chatRoomMember.update({
        where: { roomId_userId: { roomId, userId } },
        data: { unreadCount: 0, lastReadMessageId: upToMessageId },
      }),
    ]);

    return { updated: unread.length, messageIds: unread.map(m => m.id) };
  },

  // Simple text search across a room's message history.
  async searchMessages({ roomId, query, page = 1, limit = 20 }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {
      roomId: parseInt(roomId),
      deletedAt: null,
      text: { contains: query, mode: 'insensitive' },
    };

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where,
        skip,
        take,
        orderBy: { sentAt: 'desc' },
        include: { user: { select: { id: true, fullname: true } } },
      }),
      prisma.chatMessage.count({ where }),
    ]);

    return { data: messages, meta: { total, page: parseInt(page), limit: take, totalPages: Math.ceil(total / take) } };
  },
};

export default ChatMessageService;