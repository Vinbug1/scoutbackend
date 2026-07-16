import prisma from '../lib/prisma.js';
import ChatMessageService from '../services/chatMessageService.js';

// NOTE — the service layer now enforces membership internally on every
// function (requireParticipant, called uniformly per spec's checklist —
// see chatMessageService.js). The old per-route `assertIsMember` helper
// that used to live here is gone: it was redundant with that, and in
// deleteMessage's case it was actively wrong (see deleteMessage below).

const ChatMessageController = {

  async createMessage(req, res) {
    try {
      const userId = req.user.id;
      const {
        roomId,
        text,
        type,
        mediaUrl,
        thumbnailUrl,
        fileName,
        fileSize,
        durationSec,
        replyToId,
        clientTempId
      } = req.body;

      if (!roomId) {
        return res.status(400).json({ error: 'roomId is required' });
      }

      const newMessage = await ChatMessageService.createMessage({
        roomId,
        userId,
        text,
        type,
        mediaUrl,
        thumbnailUrl,
        fileName,
        fileSize,
        durationSec,
        replyToId,
        clientTempId,
      });

      const io = req.app.get('io');
      if (io) {
        const roomIdInt = parseInt(roomId);
        io.to(`room:${roomIdInt}`).emit('message:new', { message: newMessage, tempId: clientTempId });

        // FIX — was selecting `unreadCount`, which no longer exists on
        // ChatRoomMember. Unread count is now computed
        // (seqCounter - lastReadSeq), never stored (spec §7.2).
        //
        // We don't even need to re-fetch the room's seqCounter here: the
        // transaction inside createMessage assigned newMessage.seq FROM
        // that same increment, so newMessage.seq IS the room's current
        // seqCounter. And the sender's own lastReadSeq was bumped to
        // that same value inside that transaction — so by the time this
        // findMany runs, the DB already reflects unreadCount 0 for the
        // sender without any special-casing needed.
        const members = await prisma.chatRoomMember.findMany({
          where: { roomId: roomIdInt },
          select: { userId: true, lastReadSeq: true },
        });
        members.forEach(m => {
          io.to(`user:${m.userId}`).emit('conversation:updated', {
            roomId: roomIdInt,
            lastMessage: newMessage,
            unreadCount: Math.max(0, newMessage.seq - m.lastReadSeq),
          });
        });
      }

      res.status(201).json({
        message: 'Message sent successfully',
        data: newMessage
      });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to create message'
      });
    }
  },

  async getMessages(req, res) {
    try {
      const userId = req.user.id;
      const { roomId, page = 1, limit = 20 } = req.query;

      if (!roomId) {
        return res.status(400).json({ error: 'roomId is required' });
      }

      // FIX — userId was never passed to the service. getMessages is now
      // fail-closed: without userId it can't run requireParticipant, and
      // would reject every caller (including legitimate members) with a
      // 403, since a missing userId resolves to NaN internally.
      const result = await ChatMessageService.getMessages({
        roomId,
        userId,
        page,
        limit
      });

      res.status(200).json(result);

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to fetch messages'
      });
    }
  },

  async getMessagesByCursor(req, res) {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;
      const { cursor, limit = 30 } = req.query;

      // FIX — same missing userId as getMessages above.
      const result = await ChatMessageService.getMessagesByCursor({
        roomId,
        userId,
        cursor,
        limit
      });

      res.status(200).json(result);

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to fetch messages'
      });
    }
  },

  async getMessageById(req, res) {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;

      // FIX — was `getMessageById(id)`, missing userId. getMessageById is
      // fail-closed now (see the earlier service audit): a missing
      // userId isn't skipped, it's treated as an invalid caller and
      // rejected — but incidentally, that meant it was rejecting
      // everyone, not just intruders.
      const message = await ChatMessageService.getMessageById(id, userId);

      res.status(200).json({ data: message });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to fetch message'
      });
    }
  },

  async updateMessage(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { text } = req.body;
      const userId = req.user.id;

      const updated = await ChatMessageService.updateMessage(id, userId, { text });

      const io = req.app.get('io');
      if (io) {
        io.to(`room:${updated.roomId}`).emit('message:updated', { message: updated });
      }

      res.status(200).json({
        message: 'Message updated successfully',
        data: updated
      });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to update message'
      });
    }
  },

  async deleteMessage(req, res) {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      // NEW — supports "delete for me" (spec §6.2). Defaults to the
      // original "delete for everyone" behavior if the client doesn't
      // specify.
      const scope = req.body.scope || req.query.scope || 'everyone';

      // FIX — was `ChatMessageService.getMessageById(id)`, which is
      // membership-gated. That's actively wrong for scope 'everyone':
      // the spec deliberately allows a user to delete their own message
      // even after they've LEFT the room (§14.29) — so gating the
      // roomId lookup on current membership would block exactly the
      // case this feature exists for. This is a plain, unauthenticated
      // read of just the roomId, purely for the socket broadcast below;
      // the actual authorization (ownership + time window, or
      // membership for scope 'me') happens inside deleteMessage itself.
      const existing = await prisma.chatMessage.findUnique({
        where: { id },
        select: { roomId: true },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Message not found' });
      }

      await ChatMessageService.deleteMessage(id, userId, scope);

      const io = req.app.get('io');
      if (io) {
        io.to(`room:${existing.roomId}`).emit('message:deleted', {
          messageId: id,
          roomId: existing.roomId,
          scope,
        });
      }

      res.status(200).json({ message: 'Message deleted successfully' });

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to delete message'
      });
    }
  },

  async markRead(req, res) {
    try {
      const userId = req.user.id;
      const roomId = parseInt(req.params.roomId);
      // FIX — was destructuring `upToMessageId`, which the service no
      // longer accepts. ChatRoomMember tracks lastReadSeq now, not a
      // message id, so the client needs to send the message's `seq`
      // (returned on every message object), not its `id`.
      const { upToSeq } = req.body;

      const result = await ChatMessageService.markRead({
        roomId,
        userId,
        upToSeq
      });

      const io = req.app.get('io');
      if (io && result.updated > 0) {
        io.to(`room:${roomId}`).emit('message:statusUpdate', {
          roomId,
          messageIds: result.messageIds,
          status: 'READ',
          userId,
        });
        io.to(`user:${userId}`).emit('conversation:updated', { roomId, unreadCount: 0 });
      }

      res.status(200).json(result);

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to mark messages as read'
      });
    }
  },

  async markDelivered(req, res) {
    try {
      const userId = req.user.id;
      const roomId = parseInt(req.params.roomId);
      const { messageIds } = req.body;

      const result = await ChatMessageService.markDelivered({ roomId, userId, messageIds });

      const io = req.app.get('io');
      if (io && result.updated > 0) {
        io.to(`room:${roomId}`).emit('message:statusUpdate', {
          roomId,
          messageIds,
          status: 'DELIVERED',
          userId,
        });
      }

      res.status(200).json(result);

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to mark messages as delivered'
      });
    }
  },

  async searchMessages(req, res) {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;
      const { q, page = 1, limit = 20 } = req.query;

      // FIX — userId was never passed; same fail-closed issue as
      // getMessages.
      const result = await ChatMessageService.searchMessages({
        roomId,
        userId,
        query: q,
        page,
        limit
      });

      res.status(200).json(result);

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to search messages'
      });
    }
  },

  // NEW — spec §11.1: messages sent to a room while the client was
  // offline/disconnected. Bounded, with a `truncated` flag telling the
  // client to fall back to a full resync instead of trusting a partial
  // catch-up as complete.
  async getMessagesSince(req, res) {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;
      const { sinceSeq } = req.query;

      if (sinceSeq === undefined) {
        return res.status(400).json({ error: 'sinceSeq is required' });
      }

      const result = await ChatMessageService.getMessagesSince({ roomId, userId, sinceSeq });

      res.status(200).json(result);

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to fetch messages since'
      });
    }
  },

  // NEW — spec §11.2: edits/deletes that happened to a room's history
  // while offline. Uses a timestamp cursor (`since`), not seq, since an
  // edit/delete doesn't move a message's position, only its content.
  async getUpdatedMessagesSince(req, res) {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;
      const { since } = req.query;

      if (!since) {
        return res.status(400).json({ error: 'since is required' });
      }

      const result = await ChatMessageService.getUpdatedMessagesSince({ roomId, userId, since });

      res.status(200).json(result);

    } catch (error) {
      console.error(error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.statusCode ? error.message : 'Failed to fetch updated messages'
      });
    }
  },
};

export default ChatMessageController;























// import prisma from '../lib/prisma.js';
// import ChatMessageService from '../services/chatMessageService.js';

// // Confirms the requester actually belongs to the room before letting them
// // read or act on its messages. Without this, any authenticated user could
// // fetch/search another room's message history just by guessing its id.
// async function assertIsMember(roomId, userId) {
//   const membership = await prisma.chatRoomMember.findUnique({
//     where: { roomId_userId: { roomId, userId } },
//   });
//   if (!membership) {
//     const error = new Error('You are not a member of this room');
//     error.statusCode = 403;
//     throw error;
//   }
// }

// const ChatMessageController = {

//   async createMessage(req, res) {
//     try {
//       const userId = req.user.id;
//       const {
//         roomId,
//         text,
//         type,
//         mediaUrl,
//         thumbnailUrl,
//         fileName,
//         fileSize,
//         durationSec,
//         replyToId,
//         clientTempId
//       } = req.body;

//       if (!roomId) {
//         return res.status(400).json({ error: 'roomId is required' });
//       }

//       const newMessage = await ChatMessageService.createMessage({
//         roomId,
//         userId,
//         text,
//         type,
//         mediaUrl,
//         thumbnailUrl,
//         fileName,
//         fileSize,
//         durationSec,
//         replyToId,
//         clientTempId,
//       });

//       // Keep parity with the socket path: clients connected via socket.io
//       // should see this message live even though it came in over REST
//       // (e.g. a retry after a dropped socket connection, or a client that
//       // hasn't opened a socket at all).
//       const io = req.app.get('io');
//       if (io) {
//         const roomIdInt = parseInt(roomId);
//         io.to(`room:${roomIdInt}`).emit('message:new', { message: newMessage, tempId: clientTempId });

//         const members = await prisma.chatRoomMember.findMany({
//           where: { roomId: roomIdInt },
//           select: { userId: true, unreadCount: true },
//         });
//         members.forEach(m => {
//           io.to(`user:${m.userId}`).emit('conversation:updated', {
//             roomId: roomIdInt,
//             lastMessage: newMessage,
//             unreadCount: m.userId === userId ? 0 : m.unreadCount,
//           });
//         });
//       }

//       res.status(201).json({
//         message: 'Message sent successfully',
//         data: newMessage
//       });

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to create message'
//       });
//     }
//   },

//   async getMessages(req, res) {
//     try {
//       const userId = req.user.id;
//       const { roomId, page = 1, limit = 20 } = req.query;

//       if (!roomId) {
//         return res.status(400).json({ error: 'roomId is required' });
//       }

//       await assertIsMember(parseInt(roomId), userId);

//       const result = await ChatMessageService.getMessages({
//         roomId,
//         page,
//         limit
//       });

//       res.status(200).json(result);

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to fetch messages'
//       });
//     }
//   },

//   async getMessagesByCursor(req, res) {
//     try {
//       const userId = req.user.id;
//       const { roomId } = req.params;
//       const { cursor, limit = 30 } = req.query;

//       await assertIsMember(parseInt(roomId), userId);

//       const result = await ChatMessageService.getMessagesByCursor({
//         roomId,
//         cursor,
//         limit
//       });

//       res.status(200).json(result);

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to fetch messages'
//       });
//     }
//   },

//   async getMessageById(req, res) {
//     try {
//       const id = parseInt(req.params.id);
//       const userId = req.user.id;

//       const message = await ChatMessageService.getMessageById(id);

//       await assertIsMember(message.roomId, userId);

//       res.status(200).json({ data: message });

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to fetch message'
//       });
//     }
//   },

//   async updateMessage(req, res) {
//     try {
//       const id = parseInt(req.params.id);
//       const { text } = req.body;
//       const userId = req.user.id;

//       const updated = await ChatMessageService.updateMessage(id, userId, { text });

//       const io = req.app.get('io');
//       if (io) {
//         io.to(`room:${updated.roomId}`).emit('message:updated', { message: updated });
//       }

//       res.status(200).json({
//         message: 'Message updated successfully',
//         data: updated
//       });

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to update message'
//       });
//     }
//   },

//   async deleteMessage(req, res) {
//     try {
//       const id = parseInt(req.params.id);
//       const userId = req.user.id;

//       // Need roomId for the socket broadcast below, and deleteMessage()
//       // doesn't return the row — fetch it first.
//       const existing = await ChatMessageService.getMessageById(id);

//       await ChatMessageService.deleteMessage(id, userId);

//       const io = req.app.get('io');
//       if (io) {
//         io.to(`room:${existing.roomId}`).emit('message:deleted', { messageId: id, roomId: existing.roomId });
//       }

//       res.status(200).json({ message: 'Message deleted successfully' });

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to delete message'
//       });
//     }
//   },

//   async markRead(req, res) {
//     try {
//       const userId = req.user.id;
//       const roomId = parseInt(req.params.roomId);
//       const { upToMessageId } = req.body;

//       await assertIsMember(roomId, userId);

//       const result = await ChatMessageService.markRead({
//         roomId,
//         userId,
//         upToMessageId
//       });

//       const io = req.app.get('io');
//       if (io && result.updated > 0) {
//         io.to(`room:${roomId}`).emit('message:statusUpdate', {
//           roomId,
//           messageIds: result.messageIds,
//           status: 'READ',
//           userId,
//         });
//         io.to(`user:${userId}`).emit('conversation:updated', { roomId, unreadCount: 0 });
//       }

//       res.status(200).json(result);

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to mark messages as read'
//       });
//     }
//   },

//   async markDelivered(req, res) {
//     try {
//       const userId = req.user.id;
//       const roomId = parseInt(req.params.roomId);
//       const { messageIds } = req.body;

//       await assertIsMember(roomId, userId);

//       const result = await ChatMessageService.markDelivered({ roomId, userId, messageIds });

//       const io = req.app.get('io');
//       if (io && result.updated > 0) {
//         io.to(`room:${roomId}`).emit('message:statusUpdate', {
//           roomId,
//           messageIds,
//           status: 'DELIVERED',
//           userId,
//         });
//       }

//       res.status(200).json(result);

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to mark messages as delivered'
//       });
//     }
//   },

//   async searchMessages(req, res) {
//     try {
//       const userId = req.user.id;
//       const { roomId } = req.params;
//       const { q, page = 1, limit = 20 } = req.query;

//       await assertIsMember(parseInt(roomId), userId);

//       const result = await ChatMessageService.searchMessages({
//         roomId,
//         query: q,
//         page,
//         limit
//       });

//       res.status(200).json(result);

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to search messages'
//       });
//     }
//   },
// };

// export default ChatMessageController;










// import ChatMessageService from '../services/chatMessageService.js';

// const ChatMessageController = {

//   async createMessage(req, res) {
//     try {
//       const userId = req.user.id;
//       const {
//         roomId,
//         text,
//         type,
//         mediaUrl,
//         thumbnailUrl,
//         fileName,
//         fileSize,
//         durationSec,
//         replyToId,
//         clientTempId
//       } = req.body;

//       if (!roomId) {
//         return res.status(400).json({ error: 'roomId is required' });
//       }

//       const newMessage = await ChatMessageService.createMessage({
//         roomId,
//         userId,
//         text,
//         type,
//         mediaUrl,
//         thumbnailUrl,
//         fileName,
//         fileSize,
//         durationSec,
//         replyToId,
//         clientTempId,
//       });

//       res.status(201).json({
//         message: 'Message sent successfully',
//         data: newMessage
//       });

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to create message'
//       });
//     }
//   },

//   async getMessages(req, res) {
//     try {
//       const { roomId, page = 1, limit = 20 } = req.query;

//       const result = await ChatMessageService.getMessages({
//         roomId,
//         page,
//         limit
//       });

//       res.status(200).json(result);

//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Failed to fetch messages' });
//     }
//   },

//   async getMessagesByCursor(req, res) {
//     try {
//       const { roomId } = req.params;
//       const { cursor, limit = 30 } = req.query;

//       const result = await ChatMessageService.getMessagesByCursor({
//         roomId,
//         cursor,
//         limit
//       });

//       res.status(200).json(result);

//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Failed to fetch messages' });
//     }
//   },

//   async getMessageById(req, res) {
//     try {
//       const id = parseInt(req.params.id);

//       const message = await ChatMessageService.getMessageById(id);

//       res.status(200).json({ data: message });

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to fetch message'
//       });
//     }
//   },

//   async updateMessage(req, res) {
//     try {
//       const id = parseInt(req.params.id);
//       const { text } = req.body;

//       const userId = req.user.id;

//       const updated = await ChatMessageService.updateMessage(
//           id,
//           userId,
//           { text }
//       );
//       res.status(200).json({
//         message: 'Message updated successfully',
//         data: updated
//       });

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to update message'
//       });
//     }
//   },

//   async deleteMessage(req, res) {
//     try {
//       const id = parseInt(req.params.id);

//       const userId = req.user.id;

//       await ChatMessageService.deleteMessage(
//           id,
//           userId
//       );
//       res.status(200).json({ message: 'Message deleted successfully' });

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to delete message'
//       });
//     }
//   },

//   async markRead(req, res) {
//     try {
//       const userId = req.user.id;
//       const roomId = parseInt(req.params.roomId);
//       const { upToMessageId } = req.body;

//       const result = await ChatMessageService.markRead({
//         roomId,
//         userId,
//         upToMessageId
//       });

//       res.status(200).json(result);

//     } catch (error) {
//       console.error(error);
//       const status = error.statusCode || 500;
//       res.status(status).json({
//         error: error.statusCode ? error.message : 'Failed to mark messages as read'
//       });
//     }
//   },

//   async searchMessages(req, res) {
//     try {
//       const { roomId } = req.params;
//       const { q, page = 1, limit = 20 } = req.query;

//       const result = await ChatMessageService.searchMessages({
//         roomId,
//         query: q,
//         page,
//         limit
//       });

//       res.status(200).json(result);

//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Failed to search messages' });
//     }
//   },
// };

// export default ChatMessageController;

