import prisma from '../lib/prisma.js';
import ChatMessageService from '../services/chatMessageService.js';

// Confirms the requester actually belongs to the room before letting them
// read or act on its messages. Without this, any authenticated user could
// fetch/search another room's message history just by guessing its id.
async function assertIsMember(roomId, userId) {
  const membership = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (!membership) {
    const error = new Error('You are not a member of this room');
    error.statusCode = 403;
    throw error;
  }
}

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

      // Keep parity with the socket path: clients connected via socket.io
      // should see this message live even though it came in over REST
      // (e.g. a retry after a dropped socket connection, or a client that
      // hasn't opened a socket at all).
      const io = req.app.get('io');
      if (io) {
        const roomIdInt = parseInt(roomId);
        io.to(`room:${roomIdInt}`).emit('message:new', { message: newMessage, tempId: clientTempId });

        const members = await prisma.chatRoomMember.findMany({
          where: { roomId: roomIdInt },
          select: { userId: true, unreadCount: true },
        });
        members.forEach(m => {
          io.to(`user:${m.userId}`).emit('conversation:updated', {
            roomId: roomIdInt,
            lastMessage: newMessage,
            unreadCount: m.userId === userId ? 0 : m.unreadCount,
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

      await assertIsMember(parseInt(roomId), userId);

      const result = await ChatMessageService.getMessages({
        roomId,
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

      await assertIsMember(parseInt(roomId), userId);

      const result = await ChatMessageService.getMessagesByCursor({
        roomId,
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

      const message = await ChatMessageService.getMessageById(id);

      await assertIsMember(message.roomId, userId);

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

      // Need roomId for the socket broadcast below, and deleteMessage()
      // doesn't return the row — fetch it first.
      const existing = await ChatMessageService.getMessageById(id);

      await ChatMessageService.deleteMessage(id, userId);

      const io = req.app.get('io');
      if (io) {
        io.to(`room:${existing.roomId}`).emit('message:deleted', { messageId: id, roomId: existing.roomId });
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
      const { upToMessageId } = req.body;

      await assertIsMember(roomId, userId);

      const result = await ChatMessageService.markRead({
        roomId,
        userId,
        upToMessageId
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

      await assertIsMember(roomId, userId);

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

      await assertIsMember(parseInt(roomId), userId);

      const result = await ChatMessageService.searchMessages({
        roomId,
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
};

export default ChatMessageController;










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

