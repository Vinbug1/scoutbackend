import prisma from '../lib/prisma.js';

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes — spec §6.1
const DELETE_FOR_EVERYONE_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours — spec §6.2
const CATCHUP_ROW_LIMIT = 500; // spec §11.1/§11.2 — bounded reconnect catch-up

// Shared preview-text builder — used both when caching a room's last
// message (ChatLastMessage.preview) and when correcting that preview
// after an edit or delete.
function previewFor(message) {
  if (message.deletedAt) return 'This message was deleted';
  switch (message.type) {
    case 'TEXT':
      return (message.text ?? '').slice(0, 120);
    case 'IMAGE':
      return '📷 Photo';
    case 'VIDEO':
      return '🎥 Video';
    case 'FILE':
      return `📎 ${message.fileName ?? 'File'}`;
    default:
      return '';
  }
}

// Corrects the room's cached inbox preview after an edit/delete, but only
// if the message being touched is still that room's actual last message —
// a plain conditional updateMany, same pattern as the spec's
// maybeUpdateInboxPreviewOnEdit/OnDelete (§7.5). No-ops safely otherwise.
async function updateLastMessagePreviewIfNeeded(roomId, messageId, preview) {
  await prisma.chatLastMessage.updateMany({
    where: { roomId, messageId },
    data: { preview },
  });
}

// NEW — spec's "shared requireParticipant helper applied uniformly to
// every conversation-scoped handler" (implementation checklist, marked
// not optional). Every function below that touches a specific room now
// calls this before doing anything else.
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

// NEW — derives display status per spec §10.1's computeStatus, instead
// of trusting a single stored `status` column as the truth. A message's
// status is only meaningful from the SENDER's point of view ("has
// everyone else seen this yet"), and it can change as other members read
// or receive it after the message was created — so it has to be computed
// against their CURRENT lastReadSeq / delivery receipts at query time,
// not decided once and cached. otherParticipants/deliveredUserIds are
// passed in so a page of messages can share one query instead of N+1.
function computeMessageStatus(message, otherParticipants, deliveredUserIds) {
  if (otherParticipants.length === 0) return message.status; // no one else in the room (shouldn't normally happen) — fall back to stored value
  const allRead = otherParticipants.every(p => p.lastReadSeq >= message.seq);
  if (allRead) return 'READ';
  const anyDeliveredOrRead = otherParticipants.some(
    p => p.lastReadSeq >= message.seq || deliveredUserIds.has(p.userId)
  );
  if (anyDeliveredOrRead) return 'DELIVERED';
  return message.status; // typically 'SENT'
}

// Attaches a derived `status` to each message the requesting user sent
// (leaves messages sent by others untouched — status is a sender-facing
// concept). Shared by getMessages/getMessagesByCursor so both paginate
// however they like but return status the same way.
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

    // replyToId is only trustworthy once verified to belong to THIS room
    // (spec §5.2/§14.26) — otherwise a client could pass a messageId from
    // a room the sender isn't even a member of, and its text would get
    // snapshotted into replyToPreview and broadcast to every member of
    // this room. A bad/mismatched replyToId degrades to "send as a
    // normal message," it never fails the whole send.
    let validReplyToId, replyToPreview, replyToSenderId;
    if (replyToId) {
      const original = await prisma.chatMessage.findUnique({
        where: { id: parseInt(replyToId) },
        select: { id: true, roomId: true, text: true, type: true, fileName: true, userId: true, deletedAt: true },
      });
      if (original && original.roomId === roomId) {
        validReplyToId = original.id;
        replyToPreview = previewFor(original);
        replyToSenderId = original.userId;
      }
    }

    let newMessage;
    try {
      newMessage = await prisma.$transaction(async (tx) => {
        // seq is assigned from the room's monotonic counter inside the
        // same transaction as the increment — the ordering/pagination/
        // unread-cursor key (spec §5.2). sentAt is kept for display/
        // range queries only, never for cursor logic.
        const updatedRoom = await tx.chatRoom.update({
          where: { id: roomId },
          data: { seqCounter: { increment: 1 } },
          select: { seqCounter: true },
        });

        const created = await tx.chatMessage.create({
          data: {
            roomId,
            userId,
            seq: updatedRoom.seqCounter,
            text,
            type,
            mediaUrl,
            thumbnailUrl,
            fileName,
            fileSize,
            durationSec,
            replyToId: validReplyToId,
            replyToPreview,
            replyToSenderId,
            clientTempId,
          },
          include: {
            user: { select: { id: true, fullname: true, email: true } },
            room: { select: { id: true, name: true } },
            replyTo: { select: { id: true, text: true, type: true, userId: true } },
          },
        });

        await tx.chatLastMessage.upsert({
          where: { roomId },
          create: { roomId, messageId: created.id, senderId: userId, seq: created.seq, preview: previewFor(created) },
          update: { messageId: created.id, senderId: userId, seq: created.seq, preview: previewFor(created) },
        });

        // Unread count is computed (room.seqCounter - member.lastReadSeq)
        // at read time, never stored (spec §7.2). The sender's own
        // lastReadSeq IS bumped here, same as the spec's send handler —
        // you've obviously "read" your own message.
        await tx.chatRoomMember.updateMany({
          where: { roomId, userId, lastReadSeq: { lt: created.seq } },
          data: { lastReadSeq: created.seq },
        });

        return created;
      });
    } catch (err) {
      // Idempotent retry: clientTempId uniqueness is scoped to
      // (roomId, userId, clientTempId) (spec §3/§4.3). A retried send
      // with the same tempId returns the already-created message.
      if (err.code === 'P2002' && clientTempId) {
        newMessage = await prisma.chatMessage.findUnique({
          where: { roomId_userId_clientTempId: { roomId, userId, clientTempId } },
          include: {
            user: { select: { id: true, fullname: true, email: true } },
            room: { select: { id: true, name: true } },
            replyTo: { select: { id: true, text: true, type: true, userId: true } },
          },
        });
        if (!newMessage) throw err;
      } else {
        throw err;
      }
    }

    return newMessage;
  },

  // CHANGED — `userId` is now effectively required: it's used both to
  // enforce membership (requireParticipant) and to filter out messages
  // this user has "deleted for me". Pass req.user.id in from the
  // controller.
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
        orderBy: { seq: 'asc' }, // CHANGED from sentAt — seq is the strict per-room cursor
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

  // Cursor-based pagination for infinite scroll.
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
        ...(cursor ? { seq: { lt: parseInt(cursor) } } : {}), // CHANGED from id — matches @@unique([roomId, seq])
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

    // FIX — was `if (userId !== undefined)`, meaning a caller that
    // forgot to pass userId silently skipped the membership check
    // entirely. Every other function in this file fails CLOSED (bad/
    // missing userId -> requireParticipant finds no match -> 403). This
    // was the one exception. Now it's consistent: userId is required.
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

    // spec §6.1/§14.29 — editing requires CURRENT room membership,
    // deliberately asymmetric with delete below.
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

  // `scope`: 'everyone' (sender-only, time-windowed) or 'me' (hide just
  // for the caller via MessageDeletionForUser).
  async deleteMessage(id, userId, scope = 'everyone') {
    const existing = await prisma.chatMessage.findUnique({ where: { id } });

    if (!existing || existing.deletedAt) {
      const error = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }

    if (scope === 'everyone') {
      if (existing.userId !== userId) {
        const error = new Error('You can only delete your own messages');
        error.statusCode = 403;
        throw error;
      }
      // spec §14.29 — deliberately NOT requiring current room membership
      // here, unlike edit above. Retracting your own content should stay
      // possible even after you've left/been removed.
      if (Date.now() - existing.sentAt.getTime() > DELETE_FOR_EVERYONE_WINDOW_MS) {
        const error = new Error('Delete window has expired');
        error.statusCode = 400;
        throw error;
      }

      await prisma.chatMessage.update({
        where: { id },
        data: { deletedAt: new Date(), text: null, mediaUrl: null, thumbnailUrl: null, fileName: null },
      });

      await updateLastMessagePreviewIfNeeded(existing.roomId, id, 'This message was deleted');
    } else if (scope === 'me') {
      await requireParticipant(existing.roomId, userId);
      await prisma.messageDeletionForUser.upsert({
        where: { messageId_userId: { messageId: id, userId } },
        create: { messageId: id, userId },
        update: {},
      });
    } else {
      const error = new Error('Invalid delete scope');
      error.statusCode = 400;
      throw error;
    }
  },

  // Delivery is tracked per (message, user) via MessageDeliveryReceipt
  // instead of a single shared `status` column, so group rooms can
  // represent "delivered to 2 of 3 members" correctly.
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

    // NOTE — no longer writes chatMessage.status here. Status is now
    // derived at read time (computeMessageStatus/withDerivedStatus
    // above), from this receipt table + lastReadSeq, exactly matching
    // spec §10.1. Writing a shared status column here would be
    // per-recipient truth being forced into a per-message column, which
    // breaks the moment a group room has mixed delivery/read state.

    return { updated: messages.length };
  },

  // Takes `upToSeq` (not upToMessageId), matching ChatRoomMember.lastReadSeq.
  // Conditional update (lastReadSeq: { lt: upToSeq }) guards against a
  // stale/out-of-order read event moving lastReadSeq BACKWARD — plausible
  // with multiple devices or a client replaying a cached upToSeq after
  // reconnecting (spec §5.2/§14.27).
  async markRead({ roomId, userId, upToSeq }) {
    roomId = parseInt(roomId);
    userId = parseInt(userId);
    upToSeq = parseInt(upToSeq);
    const membership = await requireParticipant(roomId, userId);

    const result = await prisma.chatRoomMember.updateMany({
      where: { roomId, userId, lastReadSeq: { lt: upToSeq } },
      data: { lastReadSeq: upToSeq },
    });
    if (result.count === 0) return { updated: 0 }; // stale/no-op

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

    // NOTE — same as markDelivered: no eager chatMessage.status write.
    // The sender's tick marks for these messages are derived at read
    // time from this MessageRead + the lastReadSeq bump above.

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

    return { data: messages, meta: { total, page: parseInt(page), limit: take, totalPages: Math.ceil(total / take) } };
  },

  // NEW — spec §11.1: "new messages since I was last online," bounded
  // and with a `truncated` flag so the client knows to fall back to a
  // full resync instead of trusting a partial catch-up as complete.
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

  // NEW — spec §11.2: edits/deletes that happened while offline. Uses
  // `updatedAt` (indexed via @@index([roomId, updatedAt])) rather than
  // `seq`, since an edit/delete doesn't change a message's position,
  // only its content.
  async getUpdatedMessagesSince({ roomId, userId, since }) {
    roomId = parseInt(roomId);
    userId = parseInt(userId);
    await requireParticipant(roomId, userId);

    const updated = await prisma.chatMessage.findMany({
      where: {
        roomId,
        updatedAt: { gt: new Date(since) },
        // FIX — without this, a message the user deleted-for-themselves
        // (MessageDeletionForUser) could reappear in their client the
        // next time ANYONE edits it, since an edit bumps `updatedAt` and
        // this query only checked that timestamp. Matches the same
        // filter getMessagesSince already applies.
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
// Named export — the socket layer (typing/viewing handlers) needs the
// same membership check without duplicating it.
export { requireParticipant };
















// import prisma from '../lib/prisma.js';

// const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes — spec §6.1
// const DELETE_FOR_EVERYONE_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours — spec §6.2
// const CATCHUP_ROW_LIMIT = 500; // spec §11.1/§11.2 — bounded reconnect catch-up

// // Shared preview-text builder — used both when caching a room's last
// // message (ChatLastMessage.preview) and when correcting that preview
// // after an edit or delete.
// function previewFor(message) {
//   if (message.deletedAt) return 'This message was deleted';
//   switch (message.type) {
//     case 'TEXT':
//       return (message.text ?? '').slice(0, 120);
//     case 'IMAGE':
//       return '📷 Photo';
//     case 'VIDEO':
//       return '🎥 Video';
//     case 'FILE':
//       return `📎 ${message.fileName ?? 'File'}`;
//     default:
//       return '';
//   }
// }

// // Corrects the room's cached inbox preview after an edit/delete, but only
// // if the message being touched is still that room's actual last message —
// // a plain conditional updateMany, same pattern as the spec's
// // maybeUpdateInboxPreviewOnEdit/OnDelete (§7.5). No-ops safely otherwise.
// async function updateLastMessagePreviewIfNeeded(roomId, messageId, preview) {
//   await prisma.chatLastMessage.updateMany({
//     where: { roomId, messageId },
//     data: { preview },
//   });
// }

// // NEW — spec's "shared requireParticipant helper applied uniformly to
// // every conversation-scoped handler" (implementation checklist, marked
// // not optional). Every function below that touches a specific room now
// // calls this before doing anything else.
// async function requireParticipant(roomId, userId) {
//   const membership = await prisma.chatRoomMember.findUnique({
//     where: { roomId_userId: { roomId, userId } },
//   });
//   if (!membership) {
//     const error = new Error('You are not a member of this room');
//     error.statusCode = 403;
//     throw error;
//   }
//   return membership;
// }

// // NEW — derives display status per spec §10.1's computeStatus, instead
// // of trusting a single stored `status` column as the truth. A message's
// // status is only meaningful from the SENDER's point of view ("has
// // everyone else seen this yet"), and it can change as other members read
// // or receive it after the message was created — so it has to be computed
// // against their CURRENT lastReadSeq / delivery receipts at query time,
// // not decided once and cached. otherParticipants/deliveredUserIds are
// // passed in so a page of messages can share one query instead of N+1.
// function computeMessageStatus(message, otherParticipants, deliveredUserIds) {
//   if (otherParticipants.length === 0) return message.status; // no one else in the room (shouldn't normally happen) — fall back to stored value
//   const allRead = otherParticipants.every(p => p.lastReadSeq >= message.seq);
//   if (allRead) return 'READ';
//   const anyDeliveredOrRead = otherParticipants.some(
//     p => p.lastReadSeq >= message.seq || deliveredUserIds.has(p.userId)
//   );
//   if (anyDeliveredOrRead) return 'DELIVERED';
//   return message.status; // typically 'SENT'
// }

// // Attaches a derived `status` to each message the requesting user sent
// // (leaves messages sent by others untouched — status is a sender-facing
// // concept). Shared by getMessages/getMessagesByCursor so both paginate
// // however they like but return status the same way.
// async function withDerivedStatus(messages, roomId, userId) {
//   const ownMessages = messages.filter(m => m.userId === userId);
//   if (ownMessages.length === 0) return messages;

//   const otherParticipants = await prisma.chatRoomMember.findMany({
//     where: { roomId, userId: { not: userId } },
//     select: { userId: true, lastReadSeq: true },
//   });

//   const receipts = await prisma.messageDeliveryReceipt.findMany({
//     where: { messageId: { in: ownMessages.map(m => m.id) } },
//     select: { messageId: true, userId: true },
//   });
//   const deliveredByMessage = new Map();
//   for (const r of receipts) {
//     if (!deliveredByMessage.has(r.messageId)) deliveredByMessage.set(r.messageId, new Set());
//     deliveredByMessage.get(r.messageId).add(r.userId);
//   }

//   return messages.map(m =>
//     m.userId === userId
//       ? { ...m, status: computeMessageStatus(m, otherParticipants, deliveredByMessage.get(m.id) ?? new Set()) }
//       : m
//   );
// }

// const ChatMessageService = {

//   async createMessage({ roomId, userId, text, type = 'TEXT', mediaUrl, thumbnailUrl, fileName, fileSize, durationSec, replyToId, clientTempId }) {
//     roomId = parseInt(roomId);
//     userId = parseInt(userId);

//     const room = await prisma.chatRoom.findUnique({
//       where: { id: roomId },
//       include: { members: true },
//     });
//     if (!room) {
//       const error = new Error('Chat room not found');
//       error.statusCode = 404;
//       throw error;
//     }

//     const isMember = room.members.some(m => m.userId === userId);
//     if (!isMember) {
//       const error = new Error('You are not a member of this room');
//       error.statusCode = 403;
//       throw error;
//     }

//     const otherMembers = room.members.filter(m => m.userId !== userId);
//     for (const other of otherMembers) {
//       const blocked = await prisma.block.findFirst({
//         where: {
//           OR: [
//             { blockerId: userId, blockedId: other.userId },
//             { blockerId: other.userId, blockedId: userId },
//           ],
//         },
//       });
//       if (blocked) {
//         const error = new Error('Cannot send messages to this user');
//         error.statusCode = 403;
//         throw error;
//       }
//     }

//     if (type === 'TEXT' && !text?.trim()) {
//       const error = new Error('Message content is required for text messages');
//       error.statusCode = 400;
//       throw error;
//     }
//     if (type !== 'TEXT' && !mediaUrl) {
//       const error = new Error('mediaUrl is required for media messages');
//       error.statusCode = 400;
//       throw error;
//     }

//     // replyToId is only trustworthy once verified to belong to THIS room
//     // (spec §5.2/§14.26) — otherwise a client could pass a messageId from
//     // a room the sender isn't even a member of, and its text would get
//     // snapshotted into replyToPreview and broadcast to every member of
//     // this room. A bad/mismatched replyToId degrades to "send as a
//     // normal message," it never fails the whole send.
//     let validReplyToId, replyToPreview, replyToSenderId;
//     if (replyToId) {
//       const original = await prisma.chatMessage.findUnique({
//         where: { id: parseInt(replyToId) },
//         select: { id: true, roomId: true, text: true, type: true, fileName: true, userId: true, deletedAt: true },
//       });
//       if (original && original.roomId === roomId) {
//         validReplyToId = original.id;
//         replyToPreview = previewFor(original);
//         replyToSenderId = original.userId;
//       }
//     }

//     let newMessage;
//     try {
//       newMessage = await prisma.$transaction(async (tx) => {
//         // seq is assigned from the room's monotonic counter inside the
//         // same transaction as the increment — the ordering/pagination/
//         // unread-cursor key (spec §5.2). sentAt is kept for display/
//         // range queries only, never for cursor logic.
//         const updatedRoom = await tx.chatRoom.update({
//           where: { id: roomId },
//           data: { seqCounter: { increment: 1 } },
//           select: { seqCounter: true },
//         });

//         const created = await tx.chatMessage.create({
//           data: {
//             roomId,
//             userId,
//             seq: updatedRoom.seqCounter,
//             text,
//             type,
//             mediaUrl,
//             thumbnailUrl,
//             fileName,
//             fileSize,
//             durationSec,
//             replyToId: validReplyToId,
//             replyToPreview,
//             replyToSenderId,
//             clientTempId,
//           },
//           include: {
//             user: { select: { id: true, fullname: true, email: true } },
//             room: { select: { id: true, name: true } },
//             replyTo: { select: { id: true, text: true, type: true, userId: true } },
//           },
//         });

//         await tx.chatLastMessage.upsert({
//           where: { roomId },
//           create: { roomId, messageId: created.id, senderId: userId, seq: created.seq, preview: previewFor(created) },
//           update: { messageId: created.id, senderId: userId, seq: created.seq, preview: previewFor(created) },
//         });

//         // Unread count is computed (room.seqCounter - member.lastReadSeq)
//         // at read time, never stored (spec §7.2). The sender's own
//         // lastReadSeq IS bumped here, same as the spec's send handler —
//         // you've obviously "read" your own message.
//         await tx.chatRoomMember.updateMany({
//           where: { roomId, userId, lastReadSeq: { lt: created.seq } },
//           data: { lastReadSeq: created.seq },
//         });

//         return created;
//       });
//     } catch (err) {
//       // Idempotent retry: clientTempId uniqueness is scoped to
//       // (roomId, userId, clientTempId) (spec §3/§4.3). A retried send
//       // with the same tempId returns the already-created message.
//       if (err.code === 'P2002' && clientTempId) {
//         newMessage = await prisma.chatMessage.findUnique({
//           where: { roomId_userId_clientTempId: { roomId, userId, clientTempId } },
//           include: {
//             user: { select: { id: true, fullname: true, email: true } },
//             room: { select: { id: true, name: true } },
//             replyTo: { select: { id: true, text: true, type: true, userId: true } },
//           },
//         });
//         if (!newMessage) throw err;
//       } else {
//         throw err;
//       }
//     }

//     return newMessage;
//   },

//   // CHANGED — `userId` is now effectively required: it's used both to
//   // enforce membership (requireParticipant) and to filter out messages
//   // this user has "deleted for me". Pass req.user.id in from the
//   // controller.
//   async getMessages({ roomId, userId, page = 1, limit = 20 }) {
//     roomId = parseInt(roomId);
//     userId = parseInt(userId);
//     await requireParticipant(roomId, userId);

//     const skip = (parseInt(page) - 1) * parseInt(limit);
//     const take = parseInt(limit);
//     const where = {
//       roomId,
//       deletedAt: null,
//       deletedFor: { none: { userId } },
//     };

//     const [messages, total] = await Promise.all([
//       prisma.chatMessage.findMany({
//         where,
//         skip,
//         take,
//         orderBy: { seq: 'asc' }, // CHANGED from sentAt — seq is the strict per-room cursor
//         include: {
//           user: { select: { id: true, fullname: true, email: true } },
//           room: { select: { id: true, name: true } },
//           reads: true,
//           replyTo: { select: { id: true, text: true, type: true, userId: true } },
//         },
//       }),
//       prisma.chatMessage.count({ where }),
//     ]);

//     return {
//       data: await withDerivedStatus(messages, roomId, userId),
//       meta: {
//         total,
//         page: parseInt(page),
//         limit: take,
//         totalPages: Math.ceil(total / take),
//       },
//     };
//   },

//   // Cursor-based pagination for infinite scroll.
//   async getMessagesByCursor({ roomId, userId, cursor, limit = 30 }) {
//     roomId = parseInt(roomId);
//     userId = parseInt(userId);
//     limit = parseInt(limit);
//     await requireParticipant(roomId, userId);

//     const messages = await prisma.chatMessage.findMany({
//       where: {
//         roomId,
//         deletedAt: null,
//         deletedFor: { none: { userId } },
//         ...(cursor ? { seq: { lt: parseInt(cursor) } } : {}), // CHANGED from id — matches @@unique([roomId, seq])
//       },
//       orderBy: { seq: 'desc' },
//       take: limit,
//       include: {
//         user: { select: { id: true, fullname: true, email: true } },
//         reads: true,
//         replyTo: { select: { id: true, text: true, type: true, userId: true } },
//       },
//     });

//     const nextCursor = messages.length === limit ? messages[messages.length - 1].seq : null;
//     const withStatus = await withDerivedStatus(messages, roomId, userId);

//     return { data: withStatus.reverse(), nextCursor };
//   },

//   async getMessageById(id, userId) {
//     const message = await prisma.chatMessage.findUnique({
//       where: { id },
//       include: {
//         user: { select: { id: true, fullname: true, email: true } },
//         room: { select: { id: true, name: true } },
//         reads: true,
//       },
//     });

//     if (!message || message.deletedAt) {
//       const error = new Error('Message not found');
//       error.statusCode = 404;
//       throw error;
//     }

//     // NEW — this previously had no membership check at all; anyone who
//     // guessed/enumerated a message id could fetch it.
//     if (userId !== undefined) {
//       await requireParticipant(message.roomId, parseInt(userId));
//     }

//     return message;
//   },

//   async updateMessage(id, userId, { text }) {
//     const existing = await prisma.chatMessage.findUnique({ where: { id } });

//     if (!existing || existing.deletedAt) {
//       const error = new Error('Message not found');
//       error.statusCode = 404;
//       throw error;
//     }
//     if (existing.userId !== userId) {
//       const error = new Error('You can only edit your own messages');
//       error.statusCode = 403;
//       throw error;
//     }

//     // spec §6.1/§14.29 — editing requires CURRENT room membership,
//     // deliberately asymmetric with delete below.
//     await requireParticipant(existing.roomId, userId);

//     if (existing.type !== 'TEXT') {
//       const error = new Error('Only text messages can be edited');
//       error.statusCode = 400;
//       throw error;
//     }

//     if (Date.now() - existing.sentAt.getTime() > EDIT_WINDOW_MS) {
//       const error = new Error('Edit window has expired');
//       error.statusCode = 400;
//       throw error;
//     }

//     if (!text?.trim()) {
//       const error = new Error('Message text is required');
//       error.statusCode = 400;
//       throw error;
//     }

//     const updated = await prisma.chatMessage.update({
//       where: { id },
//       data: { text, editedAt: new Date() },
//       include: {
//         user: { select: { id: true, fullname: true, email: true } },
//         room: { select: { id: true, name: true } },
//       },
//     });

//     await updateLastMessagePreviewIfNeeded(existing.roomId, id, previewFor(updated));

//     return updated;
//   },

//   // `scope`: 'everyone' (sender-only, time-windowed) or 'me' (hide just
//   // for the caller via MessageDeletionForUser).
//   async deleteMessage(id, userId, scope = 'everyone') {
//     const existing = await prisma.chatMessage.findUnique({ where: { id } });

//     if (!existing || existing.deletedAt) {
//       const error = new Error('Message not found');
//       error.statusCode = 404;
//       throw error;
//     }

//     if (scope === 'everyone') {
//       if (existing.userId !== userId) {
//         const error = new Error('You can only delete your own messages');
//         error.statusCode = 403;
//         throw error;
//       }
//       // spec §14.29 — deliberately NOT requiring current room membership
//       // here, unlike edit above. Retracting your own content should stay
//       // possible even after you've left/been removed.
//       if (Date.now() - existing.sentAt.getTime() > DELETE_FOR_EVERYONE_WINDOW_MS) {
//         const error = new Error('Delete window has expired');
//         error.statusCode = 400;
//         throw error;
//       }

//       await prisma.chatMessage.update({
//         where: { id },
//         data: { deletedAt: new Date(), text: null, mediaUrl: null, thumbnailUrl: null, fileName: null },
//       });

//       await updateLastMessagePreviewIfNeeded(existing.roomId, id, 'This message was deleted');
//     } else if (scope === 'me') {
//       await requireParticipant(existing.roomId, userId);
//       await prisma.messageDeletionForUser.upsert({
//         where: { messageId_userId: { messageId: id, userId } },
//         create: { messageId: id, userId },
//         update: {},
//       });
//     } else {
//       const error = new Error('Invalid delete scope');
//       error.statusCode = 400;
//       throw error;
//     }
//   },

//   // Delivery is tracked per (message, user) via MessageDeliveryReceipt
//   // instead of a single shared `status` column, so group rooms can
//   // represent "delivered to 2 of 3 members" correctly.
//   async markDelivered({ roomId, userId, messageIds }) {
//     roomId = parseInt(roomId);
//     userId = parseInt(userId);
//     await requireParticipant(roomId, userId);

//     if (!Array.isArray(messageIds) || messageIds.length === 0) {
//       return { updated: 0 };
//     }
//     const ids = messageIds.map(id => parseInt(id));

//     const messages = await prisma.chatMessage.findMany({
//       where: { id: { in: ids }, roomId, userId: { not: userId }, deletedAt: null },
//       select: { id: true, seq: true },
//     });
//     if (messages.length === 0) return { updated: 0 };

//     await prisma.messageDeliveryReceipt.createMany({
//       data: messages.map(m => ({ messageId: m.id, userId })),
//       skipDuplicates: true,
//     });

//     const maxSeq = Math.max(...messages.map(m => m.seq));
//     await prisma.chatRoomMember.updateMany({
//       where: { roomId, userId, lastDeliveredSeq: { lt: maxSeq } },
//       data: { lastDeliveredSeq: maxSeq },
//     });

//     // NOTE — no longer writes chatMessage.status here. Status is now
//     // derived at read time (computeMessageStatus/withDerivedStatus
//     // above), from this receipt table + lastReadSeq, exactly matching
//     // spec §10.1. Writing a shared status column here would be
//     // per-recipient truth being forced into a per-message column, which
//     // breaks the moment a group room has mixed delivery/read state.

//     return { updated: messages.length };
//   },

//   // Takes `upToSeq` (not upToMessageId), matching ChatRoomMember.lastReadSeq.
//   // Conditional update (lastReadSeq: { lt: upToSeq }) guards against a
//   // stale/out-of-order read event moving lastReadSeq BACKWARD — plausible
//   // with multiple devices or a client replaying a cached upToSeq after
//   // reconnecting (spec §5.2/§14.27).
//   async markRead({ roomId, userId, upToSeq }) {
//     roomId = parseInt(roomId);
//     userId = parseInt(userId);
//     upToSeq = parseInt(upToSeq);
//     const membership = await requireParticipant(roomId, userId);

//     const result = await prisma.chatRoomMember.updateMany({
//       where: { roomId, userId, lastReadSeq: { lt: upToSeq } },
//       data: { lastReadSeq: upToSeq },
//     });
//     if (result.count === 0) return { updated: 0 }; // stale/no-op

//     const unread = await prisma.chatMessage.findMany({
//       where: {
//         roomId,
//         seq: { lte: upToSeq, gt: membership.lastReadSeq },
//         userId: { not: userId },
//         deletedAt: null,
//       },
//       select: { id: true, seq: true },
//     });

//     if (unread.length > 0) {
//       await prisma.messageRead.createMany({
//         data: unread.map(m => ({ messageId: m.id, userId })),
//         skipDuplicates: true,
//       });
//     }

//     // NOTE — same as markDelivered: no eager chatMessage.status write.
//     // The sender's tick marks for these messages are derived at read
//     // time from this MessageRead + the lastReadSeq bump above.

//     return { updated: unread.length, messageIds: unread.map(m => m.id) };
//   },

//   async searchMessages({ roomId, userId, query, page = 1, limit = 20 }) {
//     roomId = parseInt(roomId);
//     userId = parseInt(userId);
//     await requireParticipant(roomId, userId);

//     const skip = (parseInt(page) - 1) * parseInt(limit);
//     const take = parseInt(limit);

//     const where = {
//       roomId,
//       deletedAt: null,
//       deletedFor: { none: { userId } },
//       text: { contains: query, mode: 'insensitive' },
//     };

//     const [messages, total] = await Promise.all([
//       prisma.chatMessage.findMany({
//         where,
//         skip,
//         take,
//         orderBy: { seq: 'desc' },
//         include: { user: { select: { id: true, fullname: true } } },
//       }),
//       prisma.chatMessage.count({ where }),
//     ]);

//     return { data: messages, meta: { total, page: parseInt(page), limit: take, totalPages: Math.ceil(total / take) } };
//   },

//   // NEW — spec §11.1: "new messages since I was last online," bounded
//   // and with a `truncated` flag so the client knows to fall back to a
//   // full resync instead of trusting a partial catch-up as complete.
//   async getMessagesSince({ roomId, userId, sinceSeq }) {
//     roomId = parseInt(roomId);
//     userId = parseInt(userId);
//     sinceSeq = parseInt(sinceSeq);
//     await requireParticipant(roomId, userId);

//     const messages = await prisma.chatMessage.findMany({
//       where: {
//         roomId,
//         seq: { gt: sinceSeq },
//         deletedFor: { none: { userId } },
//       },
//       orderBy: { seq: 'asc' },
//       take: CATCHUP_ROW_LIMIT + 1,
//       include: { user: { select: { id: true, fullname: true, email: true } } },
//     });

//     const truncated = messages.length > CATCHUP_ROW_LIMIT;
//     const page = messages.slice(0, CATCHUP_ROW_LIMIT);

//     return { messages: await withDerivedStatus(page, roomId, userId), truncated };
//   },

//   // NEW — spec §11.2: edits/deletes that happened while offline. Uses
//   // `updatedAt` (indexed via @@index([roomId, updatedAt])) rather than
//   // `seq`, since an edit/delete doesn't change a message's position,
//   // only its content.
//   async getUpdatedMessagesSince({ roomId, userId, since }) {
//     roomId = parseInt(roomId);
//     userId = parseInt(userId);
//     await requireParticipant(roomId, userId);

//     const updated = await prisma.chatMessage.findMany({
//       where: { roomId, updatedAt: { gt: new Date(since) } },
//       orderBy: { updatedAt: 'asc' },
//       take: CATCHUP_ROW_LIMIT + 1,
//       select: { id: true, seq: true, text: true, mediaUrl: true, editedAt: true, deletedAt: true, updatedAt: true },
//     });

//     const truncated = updated.length > CATCHUP_ROW_LIMIT;
//     return { updated: updated.slice(0, CATCHUP_ROW_LIMIT), truncated };
//   },
// };

// export default ChatMessageService;




























































// import prisma from '../lib/prisma.js';

// const ChatMessageService = {

//   async createMessage({ roomId, userId, text, type = 'TEXT', mediaUrl, thumbnailUrl, fileName, fileSize, durationSec, replyToId, clientTempId }) {
//     roomId = parseInt(roomId);
//     userId = parseInt(userId);

//     const room = await prisma.chatRoom.findUnique({
//       where: { id: roomId },
//       include: { members: true },
//     });
//     if (!room) {
//       const error = new Error('Chat room not found');
//       error.statusCode = 404;
//       throw error;
//     }

//     const isMember = room.members.some(m => m.userId === userId);
//     if (!isMember) {
//       const error = new Error('You are not a member of this room');
//       error.statusCode = 403;
//       throw error;
//     }

//     // Block check — only meaningful for 1:1 rooms, but harmless for group rooms too
//     const otherMembers = room.members.filter(m => m.userId !== userId);
//     for (const other of otherMembers) {
//       const blocked = await prisma.block.findFirst({
//         where: {
//           OR: [
//             { blockerId: userId, blockedId: other.userId },
//             { blockerId: other.userId, blockedId: userId },
//           ],
//         },
//       });
//       if (blocked) {
//         const error = new Error('Cannot send messages to this user');
//         error.statusCode = 403;
//         throw error;
//       }
//     }

//     if (type === 'TEXT' && !text?.trim()) {
//       const error = new Error('Message content is required for text messages');
//       error.statusCode = 400;
//       throw error;
//     }
//     if (type !== 'TEXT' && !mediaUrl) {
//       const error = new Error('mediaUrl is required for media messages');
//       error.statusCode = 400;
//       throw error;
//     }

//     const newMessage = await prisma.$transaction(async (tx) => {
//       const created = await tx.chatMessage.create({
//         data: {
//           roomId,
//           userId,
//           text,
//           type,
//           mediaUrl,
//           thumbnailUrl,
//           fileName,
//           fileSize,
//           durationSec,
//           replyToId: replyToId ? parseInt(replyToId) : undefined,
//           clientTempId,
//         },
//         include: {
//           user: { select: { id: true, fullname: true, email: true } },
//           room: { select: { id: true, name: true } },
//           replyTo: { select: { id: true, text: true, type: true, userId: true } },
//         },
//       });

//       await tx.chatRoom.update({
//         where: { id: roomId },
//         data: { lastMessageId: created.id },
//       });

//       await tx.chatRoomMember.updateMany({
//         where: { roomId, userId: { not: userId } },
//         data: { unreadCount: { increment: 1 } },
//       });

//       return created;
//     });

//     return newMessage;
//   },

//   async getMessages({ roomId, page = 1, limit = 20 }) {
//     const skip = (parseInt(page) - 1) * parseInt(limit);
//     const take = parseInt(limit);
//     const where = { deletedAt: null, ...(roomId ? { roomId: parseInt(roomId) } : {}) };

//     const [messages, total] = await Promise.all([
//       prisma.chatMessage.findMany({
//         where,
//         skip,
//         take,
//         orderBy: { sentAt: 'asc' },
//         include: {
//           user: { select: { id: true, fullname: true, email: true } },
//           room: { select: { id: true, name: true } },
//           reads: true,
//           replyTo: { select: { id: true, text: true, type: true, userId: true } },
//         },
//       }),
//       prisma.chatMessage.count({ where }),
//     ]);

//     return {
//       data: messages,
//       meta: {
//         total,
//         page: parseInt(page),
//         limit: take,
//         totalPages: Math.ceil(total / take),
//       },
//     };
//   },

//   // Cursor-based pagination for infinite scroll — use this instead of
//   // getMessages() once history grows; OFFSET pagination gets slow over time.
//   async getMessagesByCursor({ roomId, cursor, limit = 30 }) {
//     roomId = parseInt(roomId);
//     limit = parseInt(limit);

//     const messages = await prisma.chatMessage.findMany({
//       where: {
//         roomId,
//         deletedAt: null,
//         ...(cursor ? { id: { lt: parseInt(cursor) } } : {}),
//       },
//       orderBy: { id: 'desc' },
//       take: limit,
//       include: {
//         user: { select: { id: true, fullname: true, email: true } },
//         reads: true,
//         replyTo: { select: { id: true, text: true, type: true, userId: true } },
//       },
//     });

//     const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;

//     return { data: messages.reverse(), nextCursor };
//   },

//   async getMessageById(id) {
//     const message = await prisma.chatMessage.findUnique({
//       where: { id },
//       include: {
//         user: { select: { id: true, fullname: true, email: true } },
//         room: { select: { id: true, name: true } },
//         reads: true,
//       },
//     });

//     if (!message || message.deletedAt) {
//       const error = new Error('Message not found');
//       error.statusCode = 404;
//       throw error;
//     }

//     return message;
//   },

//   async updateMessage(id, userId, { text }) {

//       const existing = await prisma.chatMessage.findUnique({
//           where: { id }
//       });

//       if (!existing || existing.deletedAt) {
//           const error = new Error("Message not found");
//           error.statusCode = 404;
//           throw error;
//       }

//       if (existing.userId !== userId) {
//           const error = new Error("You can only edit your own messages");
//           error.statusCode = 403;
//           throw error;
//       }

//       if (existing.type !== "TEXT") {
//           const error = new Error("Only text messages can be edited");
//           error.statusCode = 400;
//           throw error;
//       }

//       if (!text?.trim()) {
//         const error = new Error("Message text is required");
//         error.statusCode = 400;
//         throw error;
//     }

//       return prisma.chatMessage.update({
//           where: { id },
//           data: {
//               text
//           },
//           include: {
//               user: {
//                   select: {
//                       id: true,
//                       fullname: true,
//                       email: true
//                   }
//               },
//               room: {
//                   select: {
//                       id: true,
//                       name: true
//                   }
//               }
//           }
//       });

//   },

//   // Soft delete — keeps the row (so "message deleted" placeholders render
//   // correctly in history) instead of hard-removing it.
//   async deleteMessage(id, userId) {
//       const existing = await prisma.chatMessage.findUnique({
//         where: { id }
//     });

//     if (!existing || existing.deletedAt) {
//         const error = new Error("Message not found");
//         error.statusCode = 404;
//         throw error;
//     }

//     if (existing.userId !== userId) {
//         const error = new Error("You can only delete your own messages");
//         error.statusCode = 403;
//         throw error;
//     }

//     await prisma.chatMessage.update({
//         where: { id },
//         data: {
//             deletedAt: new Date(),
//             text: null,
//             mediaUrl: null,
//             thumbnailUrl: null,
//             fileName: null
//         }
//     });
//   },

//   // Called when a recipient's client acknowledges receipt over the socket
//   // (message reached the device, not necessarily read yet). Only bumps
//   // status SENT -> DELIVERED; never downgrades an already-READ message.
//   async markDelivered({ roomId, userId, messageIds }) {
//     roomId = parseInt(roomId);
//     userId = parseInt(userId);

//     if (!Array.isArray(messageIds) || messageIds.length === 0) {
//       return { updated: 0 };
//     }

//     const result = await prisma.chatMessage.updateMany({
//       where: {
//         id: { in: messageIds.map(id => parseInt(id)) },
//         roomId,
//         userId: { not: userId }, // can't "deliver" your own sent messages to yourself
//         status: 'SENT',
//         deletedAt: null,
//       },
//       data: { status: 'DELIVERED' },
//     });

//     return { updated: result.count };
//   },

//   // Mark every unread message in a room (up to upToMessageId) as read by userId.
//   async markRead({ roomId, userId, upToMessageId }) {
//     roomId = parseInt(roomId);
//     userId = parseInt(userId);
//     upToMessageId = parseInt(upToMessageId);

//     const unread = await prisma.chatMessage.findMany({
//       where: {
//         roomId,
//         id: { lte: upToMessageId },
//         userId: { not: userId },
//         deletedAt: null,
//         reads: { none: { userId } },
//       },
//       select: { id: true },
//     });

//     if (unread.length === 0) return { updated: 0 };

//     await prisma.$transaction([
//       prisma.messageRead.createMany({
//         data: unread.map(m => ({ messageId: m.id, userId })),
//         skipDuplicates: true,
//       }),
//       prisma.chatMessage.updateMany({
//         where: { id: { in: unread.map(m => m.id) } },
//         data: { status: 'READ' },
//       }),
//       prisma.chatRoomMember.update({
//         where: { roomId_userId: { roomId, userId } },
//         data: { unreadCount: 0, lastReadMessageId: upToMessageId },
//       }),
//     ]);

//     return { updated: unread.length, messageIds: unread.map(m => m.id) };
//   },

//   // Simple text search across a room's message history.
//   async searchMessages({ roomId, query, page = 1, limit = 20 }) {
//     const skip = (parseInt(page) - 1) * parseInt(limit);
//     const take = parseInt(limit);

//     const where = {
//       roomId: parseInt(roomId),
//       deletedAt: null,
//       text: { contains: query, mode: 'insensitive' },
//     };

//     const [messages, total] = await Promise.all([
//       prisma.chatMessage.findMany({
//         where,
//         skip,
//         take,
//         orderBy: { sentAt: 'desc' },
//         include: { user: { select: { id: true, fullname: true } } },
//       }),
//       prisma.chatMessage.count({ where }),
//     ]);

//     return { data: messages, meta: { total, page: parseInt(page), limit: take, totalPages: Math.ceil(total / take) } };
//   },
// };

// export default ChatMessageService;