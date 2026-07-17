import prisma from '../../lib/prisma.js';
import ChatMessageService from '../../services/chatMessageService.js';

// Golden rule from spec §1: persist first, ack the sender second,
// broadcast to others third, background work fourth. Every handler below
// follows that order. `socket.to(...)` (not `io.to(...)`) is used for
// broadcasts so the sender doesn't get a redundant echo of their own
// action — they already got it via the ack.
export default function registerMessageHandlers(io, socket) {
  const userId = socket.user.id;

  let sendChain = Promise.resolve();

  socket.on('message:send', (payload, ack) => {
    sendChain = sendChain
      .then(() => handleSend(payload, ack))
      .catch((err) => ack?.({ status: 'error', error: err.message }));
  });

  async function handleSend(payload, ack) {
    const { roomId, text, type, mediaUrl, thumbnailUrl, fileName, fileSize, durationSec, replyToId, clientTempId } = payload || {};

    if (!roomId) {
      return ack?.({ status: 'error', error: 'roomId is required' });
    }

    const message = await ChatMessageService.createMessage({
      roomId, userId, text, type, mediaUrl, thumbnailUrl, fileName, fileSize, durationSec, replyToId, clientTempId,
    });

    ack?.({ status: 'ok', message });

    socket.to(`room:${message.roomId}`).emit('message:new', { message });

    const members = await prisma.chatRoomMember.findMany({
      where: { roomId: message.roomId, userId: { not: userId } },
      select: { userId: true, lastReadSeq: true },
    });
    for (const m of members) {
      io.to(`user:${m.userId}`).emit('conversation:updated', {
        roomId: message.roomId,
        lastMessage: message,
        unreadCount: Math.max(0, message.seq - m.lastReadSeq),
      });
    }
  }

  socket.on('message:edit', async ({ messageId, text }, ack) => {
    try {
      const updated = await ChatMessageService.updateMessage(parseInt(messageId), userId, { text });
      ack?.({ status: 'ok', message: updated });
      io.to(`room:${updated.roomId}`).emit('message:updated', { message: updated });
    } catch (err) {
      ack?.({ status: 'error', error: err.message });
    }
  });

  socket.on('message:delete', async ({ messageId, scope = 'everyone' }, ack) => {
    try {
      const id = parseInt(messageId);
      const existing = await prisma.chatMessage.findUnique({
        where: { id },
        select: { roomId: true },
      });
      if (!existing) {
        return ack?.({ status: 'error', error: 'Message not found' });
      }

      await ChatMessageService.deleteMessage(id, userId, scope);
      ack?.({ status: 'ok' });

      if (scope === 'everyone') {
        io.to(`room:${existing.roomId}`).emit('message:deleted', { messageId: id, roomId: existing.roomId });
      }
    } catch (err) {
      ack?.({ status: 'error', error: err.message });
    }
  });

  socket.on('message:read', async ({ roomId, upToSeq }, ack) => {
    try {
      const result = await ChatMessageService.markRead({ roomId: parseInt(roomId), userId, upToSeq: parseInt(upToSeq) });
      ack?.({ status: 'ok', ...result });

      if (result.updated > 0) {
        socket.to(`room:${roomId}`).emit('message:statusUpdate', {
          roomId, messageIds: result.messageIds, status: 'READ', userId,
        });
        io.to(`user:${userId}`).emit('conversation:updated', { roomId, unreadCount: 0 });
      }
    } catch (err) {
      ack?.({ status: 'error', error: err.message });
    }
  });

  socket.on('message:delivered', async ({ roomId, messageIds }, ack) => {
    try {
      const result = await ChatMessageService.markDelivered({ roomId: parseInt(roomId), userId, messageIds });
      ack?.({ status: 'ok', ...result });

      if (result.updated > 0) {
        socket.to(`room:${roomId}`).emit('message:statusUpdate', {
          roomId, messageIds, status: 'DELIVERED', userId,
        });
      }
    } catch (err) {
      ack?.({ status: 'error', error: err.message });
    }
  });
}

