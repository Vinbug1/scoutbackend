import prisma from '../lib/prisma.js';
import { uploadMediaToGCS } from '../config/multer.js';

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_FOR_EVERYONE_WINDOW_MS = 6 * 60 * 60 * 1000;
const CATCHUP_ROW_LIMIT = 500;

function previewFor(message) {
  if (message.deletedAt) return 'This message was deleted';
  switch (message.type) {
    case 'TEXT':
      return (message.text ?? '').slice(0, 120);
    case 'IMAGE':
      return '📷 Photo';
    case 'VIDEO':
      return '🎥 Video';
    case 'AUDIO':
      return '🎤 Voice message';
    case 'FILE':
      return `📎 ${message.fileName ?? 'File'}`;
    default:
      return '';
  }
}

async function updateLastMessagePreviewIfNeeded(roomId, messageId, preview) {
  await prisma.chatLastMessage.updateMany({
    where: { roomId, messageId },
    data: { preview },
  });
}

async function requireParticipant(roomId, userId) {
  const membership = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });

  if (!membership) {
    const error = new Error('You are not a member of this room');
    error.statusCode = 403;
    throw error;
  }

  return membership;
}

function computeMessageStatus(message, otherParticipants, deliveredUserIds) {
  if (otherParticipants.length === 0) return message.status;
  const allRead = otherParticipants.every(p => p.lastReadSeq >= message.seq);
  if (allRead) return 'READ';
  const anyDeliveredOrRead = otherParticipants.some(
    p => p.lastReadSeq >= message.seq || deliveredUserIds.has(p.userId)
  );
  if (anyDeliveredOrRead) return 'DELIVERED';
  return message.status;
}

async function withDerivedStatus(messages, roomId, userId) {
  const ownMessages = messages.filter(m => m.userId === userId);
  if (ownMessages.length === 0) return messages;

  const otherParticipants = await prisma.chatRoomMember.findMany({
    where: { roomId, userId: { not: userId } },
    select: { userId: true, lastReadSeq: true },
  });

  const receipts = await prisma.messageDeliveryReceipt.findMany({
    where: { messageId: { in: ownMessages.map(m => m.id) } },
    select: { messageId: true, userId: true },
  });

  const deliveredByMessage = new Map();
  for (const r of receipts) {
    if (!deliveredByMessage.has(r.messageId)) deliveredByMessage.set(r.messageId, new Set());
    deliveredByMessage.get(r.messageId).add(r.userId);
  }

  return messages.map(m =>
    m.userId === userId
      ? { ...m, status: computeMessageStatus(m, otherParticipants, deliveredByMessage.get(m.id) ?? new Set()) }
      : m
  );
}

const ChatMessageService = {
  async createMessage({
    roomId,
    userId,
    text,
    type = 'TEXT',
    mediaUrl,
    thumbnailUrl,
    blurhash,
    fileName,
    fileSize,
    durationSec,
    replyToId,
    clientTempId,
  }) {
    const normalizedRoomId =
      Number.parseInt(roomId, 10);
  
    const normalizedUserId =
      Number.parseInt(userId, 10);
  
    if (
      !Number.isInteger(
        normalizedRoomId
      ) ||
      normalizedRoomId <= 0
    ) {
      const error = new Error(
        'Invalid room ID'
      );
  
      error.statusCode = 400;
      throw error;
    }
  
    if (
      !Number.isInteger(
        normalizedUserId
      ) ||
      normalizedUserId <= 0
    ) {
      const error = new Error(
        'Invalid user ID'
      );
  
      error.statusCode = 400;
      throw error;
    }
  
    const normalizedType =
      String(type).toUpperCase();
  
    const allowedTypes = [
      'TEXT',
      'IMAGE',
      'VIDEO',
      'AUDIO',
      'FILE',
    ];
  
    if (
      !allowedTypes.includes(
        normalizedType
      )
    ) {
      const error = new Error(
        'Invalid message type'
      );
  
      error.statusCode = 400;
      throw error;
    }
  
    const normalizedText =
      typeof text === 'string' &&
      text.trim().length > 0
        ? text.trim()
        : null;
  
    const normalizedMediaUrl =
      typeof mediaUrl === 'string' &&
      mediaUrl.trim().length > 0
        ? mediaUrl.trim()
        : null;
  
    const normalizedThumbnailUrl =
      typeof thumbnailUrl === 'string' &&
      thumbnailUrl.trim().length > 0
        ? thumbnailUrl.trim()
        : null;
  
    const normalizedFileName =
      typeof fileName === 'string' &&
      fileName.trim().length > 0
        ? fileName.trim()
        : null;
  
    const normalizedClientTempId =
      typeof clientTempId === 'string' &&
      clientTempId.trim().length > 0
        ? clientTempId.trim()
        : null;
  
    if (
      normalizedType === 'TEXT' &&
      !normalizedText
    ) {
      const error = new Error(
        'Message content is required for text messages'
      );
  
      error.statusCode = 400;
      throw error;
    }
  
    if (
      normalizedType !== 'TEXT' &&
      !normalizedMediaUrl
    ) {
      const error = new Error(
        'mediaUrl is required for media messages'
      );
  
      error.statusCode = 400;
      throw error;
    }
  
    /*
     * fileSize is Int? in Prisma.
     */
    const normalizedFileSize =
      fileSize === undefined ||
      fileSize === null ||
      fileSize === ''
        ? null
        : Number(fileSize);
  
    if (
      normalizedFileSize !== null &&
      (
        !Number.isInteger(
          normalizedFileSize
        ) ||
        normalizedFileSize < 0
      )
    ) {
      const error = new Error(
        'Invalid fileSize'
      );
  
      error.statusCode = 400;
      throw error;
    }
  
    /*
     * durationSec is Float? in Prisma.
     */
    const normalizedDurationSec =
      durationSec === undefined ||
      durationSec === null ||
      durationSec === ''
        ? null
        : Number(durationSec);
  
    if (
      normalizedDurationSec !== null &&
      (
        !Number.isFinite(
          normalizedDurationSec
        ) ||
        normalizedDurationSec < 0
      )
    ) {
      const error = new Error(
        'Invalid durationSec'
      );
  
      error.statusCode = 400;
      throw error;
    }
  
    /*
     * BlurHash should only be saved for an
     * IMAGE message. The controller generates
     * it from the stored image URL.
     */
    const normalizedBlurhash =
      normalizedType === 'IMAGE' &&
      typeof blurhash === 'string' &&
      blurhash.trim().length > 0
        ? blurhash.trim()
        : null;
  
    const room =
      await prisma.chatRoom.findUnique({
        where: {
          id: normalizedRoomId,
        },
        include: {
          members: true,
        },
      });
  
    if (!room) {
      const error = new Error(
        'Chat room not found'
      );
  
      error.statusCode = 404;
      throw error;
    }
  
    const isMember =
      room.members.some(
        (member) =>
          member.userId ===
          normalizedUserId
      );
  
    if (!isMember) {
      const error = new Error(
        'You are not a member of this room'
      );
  
      error.statusCode = 403;
      throw error;
    }
  
    const otherMembers =
      room.members.filter(
        (member) =>
          member.userId !==
          normalizedUserId
      );
  
    for (const other of otherMembers) {
      const blocked =
        await prisma.block.findFirst({
          where: {
            OR: [
              {
                blockerId:
                  normalizedUserId,
  
                blockedId:
                  other.userId,
              },
              {
                blockerId:
                  other.userId,
  
                blockedId:
                  normalizedUserId,
              },
            ],
          },
        });
  
      if (blocked) {
        const error = new Error(
          'Cannot send messages to this user'
        );
  
        error.statusCode = 403;
        throw error;
      }
    }
  
    let validReplyToId = null;
    let replyToPreview = null;
    let replyToSenderId = null;
  
    if (
      replyToId !== undefined &&
      replyToId !== null &&
      replyToId !== ''
    ) {
      const replyId =
        Number.parseInt(
          replyToId,
          10
        );
  
      if (
        Number.isInteger(replyId) &&
        replyId > 0
      ) {
        const original =
          await prisma.chatMessage.findUnique({
            where: {
              id: replyId,
            },
            select: {
              id: true,
              roomId: true,
              text: true,
              type: true,
              fileName: true,
              userId: true,
              deletedAt: true,
            },
          });
  
        /*
         * Ignore replies that reference a
         * message in another room.
         */
        if (
          original &&
          original.roomId ===
            normalizedRoomId
        ) {
          validReplyToId =
            original.id;
  
          replyToPreview =
            previewFor(original);
  
          replyToSenderId =
            original.userId;
        }
      }
    }
  
    let newMessage;
  
    try {
      newMessage =
        await prisma.$transaction(
          async (tx) => {
            const updatedRoom =
              await tx.chatRoom.update({
                where: {
                  id: normalizedRoomId,
                },
                data: {
                  seqCounter: {
                    increment: 1,
                  },
                },
                select: {
                  seqCounter: true,
                },
              });
  
            const created =
              await tx.chatMessage.create({
                data: {
                  roomId:
                    normalizedRoomId,
  
                  userId:
                    normalizedUserId,
  
                  seq:
                    updatedRoom.seqCounter,
  
                  clientTempId:
                    normalizedClientTempId,
  
                  type:
                    normalizedType,
  
                  text:
                    normalizedType === 'TEXT'
                      ? normalizedText
                      : null,
  
                  mediaUrl:
                    normalizedMediaUrl,
  
                  thumbnailUrl:
                    normalizedThumbnailUrl,
  
                  blurhash:
                    normalizedBlurhash,
  
                  fileName:
                    normalizedFileName,
  
                  fileSize:
                    normalizedFileSize,
  
                  durationSec:
                    normalizedDurationSec,
  
                  replyToId:
                    validReplyToId,
  
                  replyToPreview,
  
                  replyToSenderId,
                },
  
                include: {
                  user: {
                    select: {
                      id: true,
                      fullname: true,
                      email: true,
                    },
                  },
  
                  room: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
  
                  replyTo: {
                    select: {
                      id: true,
                      text: true,
                      type: true,
                      userId: true,
                    },
                  },
                },
              });
  
            await tx.chatLastMessage.upsert({
              where: {
                roomId:
                  normalizedRoomId,
              },
  
              create: {
                roomId:
                  normalizedRoomId,
  
                messageId:
                  created.id,
  
                senderId:
                  normalizedUserId,
  
                seq:
                  created.seq,
  
                preview:
                  previewFor(created),
              },
  
              update: {
                messageId:
                  created.id,
  
                senderId:
                  normalizedUserId,
  
                seq:
                  created.seq,
  
                preview:
                  previewFor(created),
              },
            });
  
            await tx.chatRoomMember.updateMany({
              where: {
                roomId:
                  normalizedRoomId,
  
                userId:
                  normalizedUserId,
  
                lastReadSeq: {
                  lt: created.seq,
                },
              },
  
              data: {
                lastReadSeq:
                  created.seq,
              },
            });
  
            return created;
          },
          {
            isolationLevel:
              'Serializable',
          }
        );
    } catch (error) {
      /*
       * Return the existing message for
       * an idempotent retry.
       */
      if (
        error.code === 'P2002' &&
        normalizedClientTempId
      ) {
        newMessage =
          await prisma.chatMessage.findUnique({
            where: {
              roomId_userId_clientTempId: {
                roomId:
                  normalizedRoomId,
  
                userId:
                  normalizedUserId,
  
                clientTempId:
                  normalizedClientTempId,
              },
            },
  
            include: {
              user: {
                select: {
                  id: true,
                  fullname: true,
                  email: true,
                },
              },
  
              room: {
                select: {
                  id: true,
                  name: true,
                },
              },
  
              replyTo: {
                select: {
                  id: true,
                  text: true,
                  type: true,
                  userId: true,
                },
              },
            },
          });
  
        if (!newMessage) {
          throw error;
        }
      } else {
        throw error;
      }
    }
  
    return newMessage;
  },
  async uploadMediaOnly({
    roomId,
    userId,
    file,
  }) {
    if (!file) {
      const error = new Error(
        'No media file provided'
      );
  
      error.statusCode = 400;
      throw error;
    }
  
    const normalizedRoomId =
      Number.parseInt(roomId, 10);
  
    const normalizedUserId =
      Number.parseInt(userId, 10);
  
    if (
      !Number.isInteger(
        normalizedRoomId
      ) ||
      normalizedRoomId <= 0
    ) {
      const error = new Error(
        'Invalid room ID'
      );
  
      error.statusCode = 400;
      throw error;
    }
  
    if (
      !Number.isInteger(
        normalizedUserId
      ) ||
      normalizedUserId <= 0
    ) {
      const error = new Error(
        'Invalid user ID'
      );
  
      error.statusCode = 400;
      throw error;
    }
  
    await requireParticipant(
      normalizedRoomId,
      normalizedUserId
    );
  
    const uploaded =
      await uploadMediaToGCS(
        file,
        `chat-media/${normalizedRoomId}`
      );
  
    return {
      url: uploaded.url,
  
      thumbnailUrl:
        uploaded.thumbnailUrl ??
        null,
  
      /*
       * Images generate BlurHash in the
       * create-message controller.
       *
       * Videos can keep the BlurHash generated
       * from their thumbnail.
       */
      blurhash:
        uploaded.mediaType === 'video'
          ? uploaded.blurhash ?? null
          : null,
  
      mediaType:
        uploaded.mediaType,
  
      fileName:
        file.originalname,
  
      fileSize:
        file.size,
  
      durationSec:
        uploaded.durationSec ??
        null,
    };
  },
  async getMessages({ roomId, userId, page = 1, limit = 20 }) {
    roomId = parseInt(roomId);
    userId = parseInt(userId);
    await requireParticipant(roomId, userId);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = {
      roomId,
      deletedAt: null,
      deletedFor: { none: { userId } },
    };

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where,
        skip,
        take,
        orderBy: { seq: 'asc' },
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
      data: await withDerivedStatus(messages, roomId, userId),
      meta: {
        total,
        page: parseInt(page),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  },

  async getMessagesByCursor({ roomId, userId, cursor, limit = 30 }) {
    roomId = parseInt(roomId);
    userId = parseInt(userId);
    limit = parseInt(limit);
    await requireParticipant(roomId, userId);

    const messages = await prisma.chatMessage.findMany({
      where: {
        roomId,
        deletedAt: null,
        deletedFor: { none: { userId } },
        ...(cursor ? { seq: { lt: parseInt(cursor) } } : {}),
      },
      orderBy: { seq: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, fullname: true, email: true } },
        reads: true,
        replyTo: { select: { id: true, text: true, type: true, userId: true } },
      },
    });

    const nextCursor = messages.length === limit ? messages[messages.length - 1].seq : null;
    const withStatus = await withDerivedStatus(messages, roomId, userId);

    return { data: withStatus.reverse(), nextCursor };
  },

  async getMessageById(id, userId) {
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

    await requireParticipant(message.roomId, parseInt(userId));
    return message;
  },

  async updateMessage(id, userId, { text }) {
    const existing = await prisma.chatMessage.findUnique({ where: { id } });

    if (!existing || existing.deletedAt) {
      const error = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }

    if (existing.userId !== userId) {
      const error = new Error('You can only edit your own messages');
      error.statusCode = 403;
      throw error;
    }

    await requireParticipant(existing.roomId, userId);

    if (existing.type !== 'TEXT') {
      const error = new Error('Only text messages can be edited');
      error.statusCode = 400;
      throw error;
    }

    if (Date.now() - existing.sentAt.getTime() > EDIT_WINDOW_MS) {
      const error = new Error('Edit window has expired');
      error.statusCode = 400;
      throw error;
    }

    if (!text?.trim()) {
      const error = new Error('Message text is required');
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.chatMessage.update({
      where: { id },
      data: { text, editedAt: new Date() },
      include: {
        user: { select: { id: true, fullname: true, email: true } },
        room: { select: { id: true, name: true } },
      },
    });

    await updateLastMessagePreviewIfNeeded(existing.roomId, id, previewFor(updated));
    return updated;
  },

  async deleteMessage(id, userId, scope = 'everyone') {
    const existing = await prisma.chatMessage.findUnique({
      where: { id },
    });
  
    if (!existing || existing.deletedAt) {
      const error = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }
  
    if (scope === 'everyone') {
      if (existing.userId !== userId) {
        const error = new Error(
          'You can only delete your own messages'
        );
        error.statusCode = 403;
        throw error;
      }
  
      if (
        Date.now() - existing.sentAt.getTime() >
        DELETE_FOR_EVERYONE_WINDOW_MS
      ) {
        const error = new Error(
          'Delete window has expired'
        );
        error.statusCode = 400;
        throw error;
      }
  
      await prisma.chatMessage.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          text: null,
          mediaUrl: null,
          thumbnailUrl: null,
          blurhash: null,
          fileName: null,
        },
      });
  
      await updateLastMessagePreviewIfNeeded(
        existing.roomId,
        id,
        'This message was deleted'
      );
  
      return {
        scope: 'everyone',
        messageId: id,
      };
    }
  
    if (scope === 'me') {
      await requireParticipant(
        existing.roomId,
        userId
      );
  
      await prisma.messageDeletionForUser.upsert({
        where: {
          messageId_userId: {
            messageId: id,
            userId,
          },
        },
        create: {
          messageId: id,
          userId,
        },
        update: {},
      });
  
      return {
        scope: 'me',
        messageId: id,
      };
    }
  
    const error = new Error('Invalid delete scope');
    error.statusCode = 400;
    throw error;
  },

  async markDelivered({ roomId, userId, messageIds }) {
    roomId = parseInt(roomId);
    userId = parseInt(userId);
    await requireParticipant(roomId, userId);

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return { updated: 0 };
    }

    const ids = messageIds.map(id => parseInt(id));

    const messages = await prisma.chatMessage.findMany({
      where: { id: { in: ids }, roomId, userId: { not: userId }, deletedAt: null },
      select: { id: true, seq: true },
    });

    if (messages.length === 0) return { updated: 0 };

    await prisma.messageDeliveryReceipt.createMany({
      data: messages.map(m => ({ messageId: m.id, userId })),
      skipDuplicates: true,
    });

    const maxSeq = Math.max(...messages.map(m => m.seq));
    await prisma.chatRoomMember.updateMany({
      where: { roomId, userId, lastDeliveredSeq: { lt: maxSeq } },
      data: { lastDeliveredSeq: maxSeq },
    });

    return { updated: messages.length };
  },

  async markRead({ roomId, userId, upToSeq }) {
    roomId = parseInt(roomId);
    userId = parseInt(userId);
    upToSeq = parseInt(upToSeq);
    const membership = await requireParticipant(roomId, userId);

    const result = await prisma.chatRoomMember.updateMany({
      where: { roomId, userId, lastReadSeq: { lt: upToSeq } },
      data: { lastReadSeq: upToSeq },
    });

    if (result.count === 0) return { updated: 0 };

    const unread = await prisma.chatMessage.findMany({
      where: {
        roomId,
        seq: { lte: upToSeq, gt: membership.lastReadSeq },
        userId: { not: userId },
        deletedAt: null,
      },
      select: { id: true, seq: true },
    });

    if (unread.length > 0) {
      await prisma.messageRead.createMany({
        data: unread.map(m => ({ messageId: m.id, userId })),
        skipDuplicates: true,
      });
    }

    return { updated: unread.length, messageIds: unread.map(m => m.id) };
  },

  async searchMessages({ roomId, userId, query, page = 1, limit = 20 }) {
    roomId = parseInt(roomId);
    userId = parseInt(userId);
    await requireParticipant(roomId, userId);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {
      roomId,
      deletedAt: null,
      deletedFor: { none: { userId } },
      text: { contains: query, mode: 'insensitive' },
    };

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where,
        skip,
        take,
        orderBy: { seq: 'desc' },
        include: { user: { select: { id: true, fullname: true } } },
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

  async getMessagesSince({ roomId, userId, sinceSeq }) {
    roomId = parseInt(roomId);
    userId = parseInt(userId);
    sinceSeq = parseInt(sinceSeq);
    await requireParticipant(roomId, userId);

    const messages = await prisma.chatMessage.findMany({
      where: {
        roomId,
        seq: { gt: sinceSeq },
        deletedFor: { none: { userId } },
      },
      orderBy: { seq: 'asc' },
      take: CATCHUP_ROW_LIMIT + 1,
      include: { user: { select: { id: true, fullname: true, email: true } } },
    });

    const truncated = messages.length > CATCHUP_ROW_LIMIT;
    const page = messages.slice(0, CATCHUP_ROW_LIMIT);

    return { messages: await withDerivedStatus(page, roomId, userId), truncated };
  },

  async getUpdatedMessagesSince({ roomId, userId, since }) {
    roomId = parseInt(roomId);
    userId = parseInt(userId);
    await requireParticipant(roomId, userId);

    const updated = await prisma.chatMessage.findMany({
      where: {
        roomId,
        updatedAt: { gt: new Date(since) },
        deletedFor: { none: { userId } },
      },
      orderBy: { updatedAt: 'asc' },
      take: CATCHUP_ROW_LIMIT + 1,
      select: { id: true, seq: true, text: true, mediaUrl: true, editedAt: true, deletedAt: true, updatedAt: true },
    });

    const truncated = updated.length > CATCHUP_ROW_LIMIT;
    return { updated: updated.slice(0, CATCHUP_ROW_LIMIT), truncated };
  },
};

export default ChatMessageService;
export { requireParticipant };

