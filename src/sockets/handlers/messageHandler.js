import prisma from '../lib/prisma.js';
import ChatMessageService from '../services/chatMessageService.js';

// Golden rule from spec §1: persist first, ack the sender second,
// broadcast to others third, background work fourth. Every handler below
// follows that order. `socket.to(...)` (not `io.to(...)`) is used for
// broadcasts so the sender doesn't get a redundant echo of their own
// action — they already got it via the ack.
export default function registerMessageHandlers(io, socket) {
  const userId = socket.user.id;

  // Serializes message:send calls from THIS socket, so a burst of rapid
  // sends (e.g. an offline queue flushing on reconnect) is processed and
  // acked in the order the client sent them. This does NOT provide
  // cross-socket/cross-user ordering — that's already guaranteed at the
  // DB level by the seqCounter increment inside
  // ChatMessageService.createMessage's transaction. This is purely about
  // this one socket's own acks not racing each other.
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

    // All validation (membership, block check, replyToId same-room
    // check, seq assignment, clientTempId idempotency) lives inside the
    // service — deliberately not duplicated here, so the socket path and
    // the REST path (chatMessageController.createMessage) can never
    // drift apart in behavior.
    const message = await ChatMessageService.createMessage({
      roomId, userId, text, type, mediaUrl, thumbnailUrl, fileName, fileSize, durationSec, replyToId, clientTempId,
    });

    ack?.({ status: 'ok', message });

    socket.to(`room:${message.roomId}`).emit('message:new', { message });

    // Inbox fan-out to every OTHER member's personal channel — same
    // shape as the REST controller's createMessage, kept in sync
    // deliberately so a socket-sent message and a REST-sent message
    // produce identical client-side state updates. Fire-and-forget, not
    // awaited by the caller (spec §7.5/checklist: "Inbox fan-out called
    // fire-and-forget, not awaited") — but we DO await it here internally
    // just to keep this function simple; the ack above has already fired
    // before this runs, so the sender isn't blocked on it either way.
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
      // Same reasoning as the REST controller: this is a plain,
      // unauthenticated lookup of just the roomId for the broadcast
      // below, NOT the membership-gated getMessageById. Scope 'everyone'
      // deliberately doesn't require current membership (spec §14.29),
      // so gating this lookup on membership would wrongly block a user
      // deleting their own message after leaving the room.
      const existing = await prisma.chatMessage.findUnique({
        where: { id },
        select: { roomId: true },
      });
      if (!existing) {
        return ack?.({ status: 'error', error: 'Message not found' });
      }

      await ChatMessageService.deleteMessage(id, userId, scope);
      ack?.({ status: 'ok' });

      // "Delete for me" is invisible to everyone else by definition —
      // only broadcast to the room for 'everyone' deletes.
      if (scope === 'everyone') {
        io.to(`room:${existing.roomId}`).emit('message:deleted', { messageId: id, roomId: existing.roomId });
      }
    } catch (err) {
      ack?.({ status: 'error', error: err.message });
    }
  });

  // Takes `upToSeq`, not a message id — matches ChatRoomMember.lastReadSeq
  // and the conditional-update guard inside markRead (spec §5.2/§14.27)
  // that prevents a stale/out-of-order read event from moving read state
  // backward.
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















// import prisma from '../lib/prisma.js';
// import ChatMessageService from '../services/chatMessageService.js';

// // Golden rule from spec §1: persist first, ack the sender second,
// // broadcast to others third, background work fourth. Every handler below
// // follows that order. `socket.to(...)` (not `io.to(...)`) is used for
// // broadcasts so the sender doesn't get a redundant echo of their own
// // action — they already got it via the ack.
// export default function registerMessageHandlers(io, socket) {
//   const userId = socket.user.id;

//   // Serializes message:send calls from THIS socket, so a burst of rapid
//   // sends (e.g. an offline queue flushing on reconnect) is processed and
//   // acked in the order the client sent them. This does NOT provide
//   // cross-socket/cross-user ordering — that's already guaranteed at the
//   // DB level by the seqCounter increment inside
//   // ChatMessageService.createMessage's transaction. This is purely about
//   // this one socket's own acks not racing each other.
//   let sendChain = Promise.resolve();

//   socket.on('message:send', (payload, ack) => {
//     sendChain = sendChain
//       .then(() => handleSend(payload, ack))
//       .catch((err) => ack?.({ status: 'error', error: err.message }));
//   });

//   async function handleSend(payload, ack) {
//     const { roomId, text, type, mediaUrl, thumbnailUrl, fileName, fileSize, durationSec, replyToId, clientTempId } = payload || {};

//     if (!roomId) {
//       return ack?.({ status: 'error', error: 'roomId is required' });
//     }

//     // All validation (membership, block check, replyToId same-room
//     // check, seq assignment, clientTempId idempotency) lives inside the
//     // service — deliberately not duplicated here, so the socket path and
//     // the REST path (chatMessageController.createMessage) can never
//     // drift apart in behavior.
//     const message = await ChatMessageService.createMessage({
//       roomId, userId, text, type, mediaUrl, thumbnailUrl, fileName, fileSize, durationSec, replyToId, clientTempId,
//     });

//     ack?.({ status: 'ok', message });

//     socket.to(`room:${message.roomId}`).emit('message:new', { message });

//     // Inbox fan-out to every OTHER member's personal channel — same
//     // shape as the REST controller's createMessage, kept in sync
//     // deliberately so a socket-sent message and a REST-sent message
//     // produce identical client-side state updates. Fire-and-forget, not
//     // awaited by the caller (spec §7.5/checklist: "Inbox fan-out called
//     // fire-and-forget, not awaited") — but we DO await it here internally
//     // just to keep this function simple; the ack above has already fired
//     // before this runs, so the sender isn't blocked on it either way.
//     const members = await prisma.chatRoomMember.findMany({
//       where: { roomId: message.roomId, userId: { not: userId } },
//       select: { userId: true, lastReadSeq: true },
//     });
//     for (const m of members) {
//       io.to(`user:${m.userId}`).emit('conversation:updated', {
//         roomId: message.roomId,
//         lastMessage: message,
//         unreadCount: Math.max(0, message.seq - m.lastReadSeq),
//       });
//     }
//   }

//   socket.on('message:edit', async ({ messageId, text }, ack) => {
//     try {
//       const updated = await ChatMessageService.updateMessage(parseInt(messageId), userId, { text });
//       ack?.({ status: 'ok', message: updated });
//       io.to(`room:${updated.roomId}`).emit('message:updated', { message: updated });
//     } catch (err) {
//       ack?.({ status: 'error', error: err.message });
//     }
//   });

//   socket.on('message:delete', async ({ messageId, scope = 'everyone' }, ack) => {
//     try {
//       const id = parseInt(messageId);
//       // Same reasoning as the REST controller: this is a plain,
//       // unauthenticated lookup of just the roomId for the broadcast
//       // below, NOT the membership-gated getMessageById. Scope 'everyone'
//       // deliberately doesn't require current membership (spec §14.29),
//       // so gating this lookup on membership would wrongly block a user
//       // deleting their own message after leaving the room.
//       const existing = await prisma.chatMessage.findUnique({
//         where: { id },
//         select: { roomId: true },
//       });
//       if (!existing) {
//         return ack?.({ status: 'error', error: 'Message not found' });
//       }

//       await ChatMessageService.deleteMessage(id, userId, scope);
//       ack?.({ status: 'ok' });

//       // "Delete for me" is invisible to everyone else by definition —
//       // only broadcast to the room for 'everyone' deletes.
//       if (scope === 'everyone') {
//         io.to(`room:${existing.roomId}`).emit('message:deleted', { messageId: id, roomId: existing.roomId });
//       }
//     } catch (err) {
//       ack?.({ status: 'error', error: err.message });
//     }
//   });

//   // Takes `upToSeq`, not a message id — matches ChatRoomMember.lastReadSeq
//   // and the conditional-update guard inside markRead (spec §5.2/§14.27)
//   // that prevents a stale/out-of-order read event from moving read state
//   // backward.
//   socket.on('message:read', async ({ roomId, upToSeq }, ack) => {
//     try {
//       const result = await ChatMessageService.markRead({ roomId: parseInt(roomId), userId, upToSeq: parseInt(upToSeq) });
//       ack?.({ status: 'ok', ...result });

//       if (result.updated > 0) {
//         socket.to(`room:${roomId}`).emit('message:statusUpdate', {
//           roomId, messageIds: result.messageIds, status: 'READ', userId,
//         });
//         io.to(`user:${userId}`).emit('conversation:updated', { roomId, unreadCount: 0 });
//       }
//     } catch (err) {
//       ack?.({ status: 'error', error: err.message });
//     }
//   });

//   socket.on('message:delivered', async ({ roomId, messageIds }, ack) => {
//     try {
//       const result = await ChatMessageService.markDelivered({ roomId: parseInt(roomId), userId, messageIds });
//       ack?.({ status: 'ok', ...result });

//       if (result.updated > 0) {
//         socket.to(`room:${roomId}`).emit('message:statusUpdate', {
//           roomId, messageIds, status: 'DELIVERED', userId,
//         });
//       }
//     } catch (err) {
//       ack?.({ status: 'error', error: err.message });
//     }
//   });
// }