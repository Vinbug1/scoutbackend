import prisma from '../lib/prisma.js';
import ChatMessageService from '../services/chatMessageService.js';
import { generateBlurHashFromImageUrl } from '../utils/blurhash-utils.js';

// NOTE — the service layer now enforces membership internally on every
// function (requireParticipant, called uniformly per spec's checklist —
// see chatMessageService.js). The old per-route `assertIsMember` helper
// that used to live here is gone: it was redundant with that, and in
// deleteMessage's case it was actively wrong (see deleteMessage below).

const ChatMessageController = {
  async createMessage(req, res) {
    try {
      const userId = Number(req.user.id);
  
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
        clientTempId,
      } = req.body;
  
      if (!roomId) {
        return res.status(400).json({
          error: 'roomId is required',
        });
      }
  
      if (!type) {
        return res.status(400).json({
          error: 'type is required',
        });
      }
  
      const normalizedType =
        String(type).toUpperCase();
  
      const allowedTypes = [
        'TEXT',
        'IMAGE',
        'VIDEO',
        'FILE',
      ];
  
      if (!allowedTypes.includes(normalizedType)) {
        return res.status(400).json({
          error: 'Invalid message type',
        });
      }
  
      const normalizedMediaUrl =
        typeof mediaUrl === 'string' &&
        mediaUrl.trim().length > 0
          ? mediaUrl.trim()
          : null;
  
      if (
        ['IMAGE', 'VIDEO', 'FILE'].includes(
          normalizedType
        ) &&
        !normalizedMediaUrl
      ) {
        return res.status(400).json({
          error:
            'mediaUrl is required for media messages',
        });
      }
  
      if (
        normalizedType === 'TEXT' &&
        (
          typeof text !== 'string' ||
          text.trim().length === 0
        )
      ) {
        return res.status(400).json({
          error: 'text is required for text messages',
        });
      }
  
      let generatedBlurhash = null;
  
      /*
       * Generate BlurHash only when the message is being sent.
       *
       * The client-provided blurhash is intentionally ignored.
       */
      if (
        normalizedType === 'IMAGE' &&
        normalizedMediaUrl
      ) {
        try {
          generatedBlurhash =
            await generateBlurHashFromImageUrl(
              normalizedMediaUrl
            );
        } catch (error) {
          console.error(
            'Failed to generate image BlurHash:',
            error
          );
  
          return res.status(400).json({
            error:
              'Unable to generate BlurHash from the image URL',
          });
        }
      }
  
      const newMessage =
        await ChatMessageService.createMessage({
          roomId: Number(roomId),
          userId,
  
          text:
            normalizedType === 'TEXT'
              ? text?.trim() || null
              : null,
  
          type: normalizedType,
          mediaUrl: normalizedMediaUrl,
          thumbnailUrl:
            thumbnailUrl || null,
  
          /*
           * This is the generated value that will be
           * persisted in ChatMessage.blurhash.
           */
          blurhash: generatedBlurhash,
  
          fileName:
            fileName || null,
  
          fileSize:
            fileSize !== undefined &&
            fileSize !== null
              ? Number(fileSize)
              : null,
  
          durationSec:
            durationSec !== undefined &&
            durationSec !== null
              ? Number(durationSec)
              : null,
  
          replyToId:
            replyToId !== undefined &&
            replyToId !== null
              ? Number(replyToId)
              : null,
  
          clientTempId:
            clientTempId || null,
        });
  
      const io = req.app.get('io');
  
      if (io) {
        const roomIdInt = Number(roomId);
  
        io.to(`room:${roomIdInt}`).emit(
          'message:new',
          {
            message: newMessage,
            tempId: clientTempId || null,
          }
        );
  
        const members =
          await prisma.chatRoomMember.findMany({
            where: {
              roomId: roomIdInt,
            },
            select: {
              userId: true,
              lastReadSeq: true,
            },
          });
  
        members.forEach((member) => {
          io.to(`user:${member.userId}`).emit(
            'conversation:updated',
            {
              roomId: roomIdInt,
              lastMessage: newMessage,
              unreadCount: Math.max(
                0,
                newMessage.seq -
                  member.lastReadSeq
              ),
            }
          );
        });
      }
  
      return res.status(201).json({
        message: 'Message sent successfully',
        data: newMessage,
      });
    } catch (error) {
      console.error(error);
  
      const status =
        error.statusCode || 500;
  
      return res.status(status).json({
        error: error.statusCode
          ? error.message
          : 'Failed to create message',
      });
    }
  },

  // async createMessage(req, res) {
  //   try {
  //     const userId = req.user.id;
  //     const {
  //       roomId,
  //       text,
  //       type,
  //       mediaUrl,
  //       thumbnailUrl,
  //       blurhash,
  //       fileName,
  //       fileSize,
  //       durationSec,
  //       replyToId,
  //       clientTempId
  //     } = req.body;

  //     if (!roomId) {
  //       return res.status(400).json({ error: 'roomId is required' });
  //     }

  //     const newMessage = await ChatMessageService.createMessage({
  //       roomId,
  //       userId,
  //       text,
  //       type,
  //       mediaUrl,
  //       thumbnailUrl,
  //       blurhash,
  //       fileName,
  //       fileSize,
  //       durationSec,
  //       replyToId,
  //       clientTempId,
  //     });

  //     const io = req.app.get('io');
  //     if (io) {
  //       const roomIdInt = parseInt(roomId);
  //       io.to(`room:${roomIdInt}`).emit('message:new', { message: newMessage, tempId: clientTempId });

  //       // FIX — was selecting `unreadCount`, which no longer exists on
  //       // ChatRoomMember. Unread count is now computed
  //       // (seqCounter - lastReadSeq), never stored (spec §7.2).
  //       //
  //       // We don't even need to re-fetch the room's seqCounter here: the
  //       // transaction inside createMessage assigned newMessage.seq FROM
  //       // that same increment, so newMessage.seq IS the room's current
  //       // seqCounter. And the sender's own lastReadSeq was bumped to
  //       // that same value inside that transaction — so by the time this
  //       // findMany runs, the DB already reflects unreadCount 0 for the
  //       // sender without any special-casing needed.
  //       const members = await prisma.chatRoomMember.findMany({
  //         where: { roomId: roomIdInt },
  //         select: { userId: true, lastReadSeq: true },
  //       });
  //       members.forEach(m => {
  //         io.to(`user:${m.userId}`).emit('conversation:updated', {
  //           roomId: roomIdInt,
  //           lastMessage: newMessage,
  //           unreadCount: Math.max(0, newMessage.seq - m.lastReadSeq),
  //         });
  //       });
  //     }

  //     res.status(201).json({
  //       message: 'Message sent successfully',
  //       data: newMessage
  //     });

  //   } catch (error) {
  //     console.error(error);
  //     const status = error.statusCode || 500;
  //     res.status(status).json({
  //       error: error.statusCode ? error.message : 'Failed to create message'
  //     });
  //   }
  // },

  async uploadMedia(req, res) {
    try {
      const userId = req.user.id;
      const { roomId } = req.body;
  
      if (!roomId) {
        return res.status(400).json({
          error: 'roomId is required',
        });
      }
  
      const mediaFile =
        req.files?.media?.[0] ||
        req.file ||
        null;
  
      if (!mediaFile) {
        return res.status(400).json({
          error: 'media file is required',
        });
      }
  
      const result = await ChatMessageService.uploadMediaOnly({
        roomId,
        userId,
        file: mediaFile,
      });
  
      return res.status(200).json({
        message: 'Media uploaded successfully',
        data: {
          url: result.url,
          thumbnailUrl: result.thumbnailUrl ?? null,
          blurhash: result.blurhash ?? null,
          mediaType: result.mediaType,
          fileName: result.fileName,
          fileSize: result.fileSize,
          durationSec: result.durationSec ?? null,
        },
      });
    } catch (error) {
      console.error(error);
  
      const status = error.statusCode || 500;
  
      return res.status(status).json({
        error: error.statusCode
          ? error.message
          : 'Failed to upload media',
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
      const id = Number.parseInt(req.params.id, 10);
      const userId = req.user.id;
  
      if (!Number.isInteger(id)) {
        return res.status(400).json({
          error: 'Invalid message ID',
        });
      }
  
      const scope =
        req.body?.scope ||
        req.query?.scope ||
        'everyone';
  
      if (!['everyone', 'me'].includes(scope)) {
        return res.status(400).json({
          error: 'Invalid delete scope',
        });
      }
  
      // Only retrieve the room ID for socket notification.
      // Authorization is handled inside ChatMessageService.deleteMessage().
      const existing = await prisma.chatMessage.findUnique({
        where: { id },
        select: { roomId: true },
      });
  
      if (!existing) {
        return res.status(404).json({
          error: 'Message not found',
        });
      }
  
      await ChatMessageService.deleteMessage(
        id,
        userId,
        scope
      );
  
      const io = req.app.get('io');
  
      if (io) {
        if (scope === 'everyone') {
          // Everyone in the room should receive this event.
          io.to(`room:${existing.roomId}`).emit(
            'message:deleted',
            {
              messageId: id,
              roomId: existing.roomId,
              scope: 'everyone',
            }
          );
        } else {
          // Only the requesting user's UI should remove this message.
          io.to(`user:${userId}`).emit(
            'message:deleted',
            {
              messageId: id,
              roomId: existing.roomId,
              scope: 'me',
              userId,
            }
          );
        }
      }
  
      return res.status(200).json({
        message: scope === 'everyone'
          ? 'Message deleted for everyone'
          : 'Message deleted for you',
        data: {
          messageId: id,
          roomId: existing.roomId,
          scope,
        },
      });
    } catch (error) {
      console.error(error);
  
      const status = error.statusCode || 500;
  
      return res.status(status).json({
        error: error.statusCode
          ? error.message
          : 'Failed to delete message',
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







