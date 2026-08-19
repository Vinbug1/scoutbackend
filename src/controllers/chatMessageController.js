import prisma from '../lib/prisma.js';
import ChatMessageService from '../services/chatMessageService.js';
import {
  generateBlurHashFromImageUrl,
} from '../utils/blurhash-utils.js';


// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const getAuthenticatedUserId = (req) => {
  const userId = Number(req.user?.id);

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    const error = new Error(
      'Unauthenticated request'
    );

    error.statusCode = 401;
    throw error;
  }

  return userId;
};

const parsePositiveInt = (
  value,
  fieldName
) => {
  const parsed = Number.parseInt(
    value,
    10
  );

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    const error = new Error(
      `Invalid ${fieldName}`
    );

    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

const parseNullableNumber = (
  value,
  fieldName
) => {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    const error = new Error(
      `Invalid ${fieldName}`
    );

    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

const parseNullableInt = (
  value,
  fieldName
) => {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    const error = new Error(
      `Invalid ${fieldName}`
    );

    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

const getErrorResponse = (
  error,
  fallbackMessage
) => {
  const status =
    error.statusCode || 500;

  const response = {
    error: error.statusCode
      ? error.message
      : fallbackMessage,
  };

  if (
    process.env.NODE_ENV !==
    'production'
  ) {
    response.details = error.message;
  }

  return {
    status,
    response,
  };
};

const logError = (
  label,
  error
) => {
  console.error(label, {
    message: error.message,
    stack: error.stack,
    code: error.code,
    meta: error.meta,
  });
};

const normalizeOptionalString = (
  value
) => {
  if (
    typeof value !== 'string'
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized.length > 0
    ? normalized
    : null;
};


// ─────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────

const ChatMessageController = {
  async createMessage(req, res) {
    try {
      const userId =
        getAuthenticatedUserId(req);

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

      const roomIdInt =
        parsePositiveInt(
          roomId,
          'roomId'
        );

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
        'AUDIO',
        'FILE',
      ];

      if (
        !allowedTypes.includes(
          normalizedType
        )
      ) {
        return res.status(400).json({
          error: 'Invalid message type',
        });
      }

      const normalizedText =
        normalizeOptionalString(text);

      const normalizedMediaUrl =
        normalizeOptionalString(
          mediaUrl
        );

      const normalizedThumbnailUrl =
        normalizeOptionalString(
          thumbnailUrl
        );

      const normalizedFileName =
        normalizeOptionalString(
          fileName
        );

      const normalizedClientTempId =
        normalizeOptionalString(
          clientTempId
        );

      const mediaTypes = [
        'IMAGE',
        'VIDEO',
        'AUDIO',
        'FILE',
      ];

      if (
        mediaTypes.includes(
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
        !normalizedText
      ) {
        return res.status(400).json({
          error:
            'text is required for text messages',
        });
      }

      /*
       * Never trust a BlurHash received from
       * the client.
       *
       * BlurHash is generated only for IMAGE
       * messages, from the image already stored
       * in Google Cloud Storage.
       */
      let generatedBlurhash = null;

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
          /*
           * BlurHash is optional metadata. The
           * message can still be sent if generation
           * fails.
           */
          logError(
            'Image BlurHash generation failed',
            error
          );

          generatedBlurhash = null;
        }
      }

      /*
       * fileSize is an integer in your Prisma
       * schema, so reject decimal values.
       */
      const normalizedFileSize =
        parseNullableInt(
          fileSize,
          'fileSize'
        );

      /*
       * durationSec should be Float? in Prisma
       * if you want to preserve values such as
       * 9.633.
       */
      const normalizedDurationSec =
        parseNullableNumber(
          durationSec,
          'durationSec'
        );

      const normalizedReplyToId =
        replyToId === undefined ||
        replyToId === null ||
        replyToId === ''
          ? null
          : parsePositiveInt(
              replyToId,
              'replyToId'
            );

      const newMessage =
        await ChatMessageService.createMessage({
          roomId: roomIdInt,
          userId,

          text:
            normalizedType === 'TEXT'
              ? normalizedText
              : null,

          type: normalizedType,

          mediaUrl:
            normalizedMediaUrl,

          thumbnailUrl:
            normalizedThumbnailUrl,

          /*
           * For IMAGE, this contains the
           * server-generated BlurHash.
           *
           * For AUDIO, VIDEO, and FILE, it is
           * null unless your service generates
           * another type of media placeholder.
           */
          blurhash:
            generatedBlurhash,

          fileName:
            normalizedFileName,

          fileSize:
            normalizedFileSize,

          durationSec:
            normalizedDurationSec,

          replyToId:
            normalizedReplyToId,

          clientTempId:
            normalizedClientTempId,
        });

      const io =
        req.app.get('io');

      if (io) {
        io.to(
          `room:${roomIdInt}`
        ).emit(
          'message:new',
          {
            message: newMessage,
            tempId:
              normalizedClientTempId,
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
          io.to(
            `user:${member.userId}`
          ).emit(
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
        message:
          'Message sent successfully',
        data: newMessage,
      });
    } catch (error) {
      logError(
        'Create message failed',
        error
      );

      const {
        status,
        response,
      } = getErrorResponse(
        error,
        'Failed to create message'
      );

      return res
        .status(status)
        .json(response);
    }
  },

  async uploadMedia(req, res) {
    try {
      const userId =
        getAuthenticatedUserId(req);

      const roomId =
        parsePositiveInt(
          req.body?.roomId,
          'roomId'
        );

      const mediaFile =
        req.files?.media?.[0] ||
        req.file ||
        null;

      if (!mediaFile) {
        return res.status(400).json({
          error: 'media file is required',
        });
      }

      const result =
        await ChatMessageService.uploadMediaOnly({
          roomId,
          userId,
          file: mediaFile,
        });

      return res.status(200).json({
        message:
          'Media uploaded successfully',

        data: {
          url: result.url,

          thumbnailUrl:
            result.thumbnailUrl ??
            null,

          /*
           * This is null for images because
           * their BlurHash is generated when
           * the message is sent.
           *
           * A video may contain a thumbnail
           * BlurHash if your upload service
           * generates one.
           */
          blurhash:
            result.blurhash ??
            null,

          mediaType:
            result.mediaType,

          fileName:
            result.fileName,

          fileSize:
            result.fileSize,

          durationSec:
            result.durationSec ??
            null,
        },
      });
    } catch (error) {
      logError(
        'Media upload failed',
        error
      );

      const {
        status,
        response,
      } = getErrorResponse(
        error,
        'Failed to upload media'
      );

      return res
        .status(status)
        .json(response);
    }
  },

  async getMessages(req, res) {
    try {
      const userId =
        getAuthenticatedUserId(req);

      const roomId =
        parsePositiveInt(
          req.query.roomId,
          'roomId'
        );

      const result =
        await ChatMessageService.getMessages({
          roomId,
          userId,
          page:
            req.query.page || 1,
          limit:
            req.query.limit || 20,
        });

      return res.status(200).json(
        result
      );
    } catch (error) {
      logError(
        'Get messages failed',
        error
      );

      const {
        status,
        response,
      } = getErrorResponse(
        error,
        'Failed to fetch messages'
      );

      return res
        .status(status)
        .json(response);
    }
  },

  async getMessagesByCursor(req, res) {
    try {
      const userId =
        getAuthenticatedUserId(req);

      const roomId =
        parsePositiveInt(
          req.params.roomId,
          'roomId'
        );

      const {
        cursor,
        limit = 30,
      } = req.query;

      const result =
        await ChatMessageService
          .getMessagesByCursor({
            roomId,
            userId,
            cursor,
            limit,
          });

      return res.status(200).json(
        result
      );
    } catch (error) {
      logError(
        'Get messages by cursor failed',
        error
      );

      const {
        status,
        response,
      } = getErrorResponse(
        error,
        'Failed to fetch messages'
      );

      return res
        .status(status)
        .json(response);
    }
  },

  async getMessageById(req, res) {
    try {
      const id =
        parsePositiveInt(
          req.params.id,
          'message ID'
        );

      const userId =
        getAuthenticatedUserId(req);

      const message =
        await ChatMessageService
          .getMessageById(
            id,
            userId
          );

      return res.status(200).json({
        data: message,
      });
    } catch (error) {
      logError(
        'Get message failed',
        error
      );

      const {
        status,
        response,
      } = getErrorResponse(
        error,
        'Failed to fetch message'
      );

      return res
        .status(status)
        .json(response);
    }
  },

  async updateMessage(req, res) {
    try {
      const id =
        parsePositiveInt(
          req.params.id,
          'message ID'
        );

      const userId =
        getAuthenticatedUserId(req);

      const {
        text,
      } = req.body;

      const updated =
        await ChatMessageService.updateMessage(
          id,
          userId,
          {
            text,
          }
        );

      const io =
        req.app.get('io');

      if (io) {
        io.to(
          `room:${updated.roomId}`
        ).emit(
          'message:updated',
          {
            message: updated,
          }
        );
      }

      return res.status(200).json({
        message:
          'Message updated successfully',
        data: updated,
      });
    } catch (error) {
      logError(
        'Update message failed',
        error
      );

      const {
        status,
        response,
      } = getErrorResponse(
        error,
        'Failed to update message'
      );

      return res
        .status(status)
        .json(response);
    }
  },

  async deleteMessage(req, res) {
    try {
      const id =
        parsePositiveInt(
          req.params.id,
          'message ID'
        );

      const userId =
        getAuthenticatedUserId(req);

      const scope =
        req.body?.scope ||
        req.query?.scope ||
        'everyone';

      if (
        !['everyone', 'me'].includes(
          scope
        )
      ) {
        return res.status(400).json({
          error: 'Invalid delete scope',
        });
      }

      const existing =
        await prisma.chatMessage.findUnique({
          where: {
            id,
          },
          select: {
            roomId: true,
          },
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

      const io =
        req.app.get('io');

      if (io) {
        if (scope === 'everyone') {
          io.to(
            `room:${existing.roomId}`
          ).emit(
            'message:deleted',
            {
              messageId: id,
              roomId: existing.roomId,
              scope: 'everyone',
            }
          );
        } else {
          io.to(
            `user:${userId}`
          ).emit(
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
        message:
          scope === 'everyone'
            ? 'Message deleted for everyone'
            : 'Message deleted for you',

        data: {
          messageId: id,
          roomId: existing.roomId,
          scope,
        },
      });
    } catch (error) {
      logError(
        'Delete message failed',
        error
      );

      const {
        status,
        response,
      } = getErrorResponse(
        error,
        'Failed to delete message'
      );

      return res
        .status(status)
        .json(response);
    }
  },

  async markRead(req, res) {
    try {
      const userId =
        getAuthenticatedUserId(req);

      const roomId =
        parsePositiveInt(
          req.params.roomId,
          'roomId'
        );

      const upToSeq =
        parsePositiveInt(
          req.body?.upToSeq,
          'upToSeq'
        );

      const result =
        await ChatMessageService.markRead({
          roomId,
          userId,
          upToSeq,
        });

      const io =
        req.app.get('io');

      if (
        io &&
        result.updated > 0
      ) {
        io.to(
          `room:${roomId}`
        ).emit(
          'message:statusUpdate',
          {
            roomId,
            messageIds:
              result.messageIds,
            status: 'READ',
            userId,
          }
        );

        io.to(
          `user:${userId}`
        ).emit(
          'conversation:updated',
          {
            roomId,
            unreadCount: 0,
          }
        );
      }

      return res.status(200).json(
        result
      );
    } catch (error) {
      logError(
        'Mark messages read failed',
        error
      );

      const {
        status,
        response,
      } = getErrorResponse(
        error,
        'Failed to mark messages as read'
      );

      return res
        .status(status)
        .json(response);
    }
  },

  async markDelivered(req, res) {
    try {
      const userId =
        getAuthenticatedUserId(req);

      const roomId =
        parsePositiveInt(
          req.params.roomId,
          'roomId'
        );

      const {
        messageIds,
      } = req.body;

      const result =
        await ChatMessageService
          .markDelivered({
            roomId,
            userId,
            messageIds,
          });

      const io =
        req.app.get('io');

      if (
        io &&
        result.updated > 0
      ) {
        io.to(
          `room:${roomId}`
        ).emit(
          'message:statusUpdate',
          {
            roomId,
            messageIds,
            status: 'DELIVERED',
            userId,
          }
        );
      }

      return res.status(200).json(
        result
      );
    } catch (error) {
      logError(
        'Mark messages delivered failed',
        error
      );

      const {
        status,
        response,
      } = getErrorResponse(
        error,
        'Failed to mark messages as delivered'
      );

      return res
        .status(status)
        .json(response);
    }
  },

  async searchMessages(req, res) {
    try {
      const userId =
        getAuthenticatedUserId(req);

      const roomId =
        parsePositiveInt(
          req.params.roomId,
          'roomId'
        );

      const query =
        typeof req.query.q === 'string'
          ? req.query.q.trim()
          : '';

      if (!query) {
        return res.status(400).json({
          error: 'Search query is required',
        });
      }

      const result =
        await ChatMessageService
          .searchMessages({
            roomId,
            userId,
            query,
            page:
              req.query.page || 1,
            limit:
              req.query.limit || 20,
          });

      return res.status(200).json(
        result
      );
    } catch (error) {
      logError(
        'Search messages failed',
        error
      );

      const {
        status,
        response,
      } = getErrorResponse(
        error,
        'Failed to search messages'
      );

      return res
        .status(status)
        .json(response);
    }
  },

  async getMessagesSince(req, res) {
    try {
      const userId =
        getAuthenticatedUserId(req);

      const roomId =
        parsePositiveInt(
          req.params.roomId,
          'roomId'
        );

      if (
        req.query.sinceSeq === undefined
      ) {
        return res.status(400).json({
          error: 'sinceSeq is required',
        });
      }

      const sinceSeq =
        parsePositiveInt(
          req.query.sinceSeq,
          'sinceSeq'
        );

      const result =
        await ChatMessageService
          .getMessagesSince({
            roomId,
            userId,
            sinceSeq,
          });

      return res.status(200).json(
        result
      );
    } catch (error) {
      logError(
        'Get messages since failed',
        error
      );

      const {
        status,
        response,
      } = getErrorResponse(
        error,
        'Failed to fetch messages since'
      );

      return res
        .status(status)
        .json(response);
    }
  },

  async getUpdatedMessagesSince(
    req,
    res
  ) {
    try {
      const userId =
        getAuthenticatedUserId(req);

      const roomId =
        parsePositiveInt(
          req.params.roomId,
          'roomId'
        );

      const {
        since,
      } = req.query;

      if (!since) {
        return res.status(400).json({
          error: 'since is required',
        });
      }

      const sinceDate =
        new Date(since);

      if (
        Number.isNaN(
          sinceDate.getTime()
        )
      ) {
        return res.status(400).json({
          error:
            'since must be a valid date',
        });
      }

      const result =
        await ChatMessageService
          .getUpdatedMessagesSince({
            roomId,
            userId,
            since:
              sinceDate.toISOString(),
          });

      return res.status(200).json(
        result
      );
    } catch (error) {
      logError(
        'Get updated messages failed',
        error
      );

      const {
        status,
        response,
      } = getErrorResponse(
        error,
        'Failed to fetch updated messages'
      );

      return res
        .status(status)
        .json(response);
    }
  },
};

export default ChatMessageController;













// import prisma from '../lib/prisma.js';
// import ChatMessageService from '../services/chatMessageService.js';
// import {
//   generateBlurHashFromImageUrl,
// } from '../utils/blurhash-utils.js';


// // ─────────────────────────────────────────────
// // Helpers
// // ─────────────────────────────────────────────

// const getAuthenticatedUserId = (req) => {
//   const userId = Number(req.user?.id);

//   if (!Number.isInteger(userId) || userId <= 0) {
//     const error = new Error('Unauthenticated request');
//     error.statusCode = 401;
//     throw error;
//   }

//   return userId;
// };

// const parsePositiveInt = (value, fieldName) => {
//   const parsed = Number.parseInt(value, 10);

//   if (!Number.isInteger(parsed) || parsed <= 0) {
//     const error = new Error(`Invalid ${fieldName}`);
//     error.statusCode = 400;
//     throw error;
//   }

//   return parsed;
// };

// const parseNullableNumber = (
//   value,
//   fieldName
// ) => {
//   if (
//     value === undefined ||
//     value === null ||
//     value === ''
//   ) {
//     return null;
//   }

//   const parsed = Number(value);

//   if (!Number.isFinite(parsed) || parsed < 0) {
//     const error = new Error(`Invalid ${fieldName}`);
//     error.statusCode = 400;
//     throw error;
//   }

//   return parsed;
// };

// const getErrorResponse = (
//   error,
//   fallbackMessage
// ) => {
//   const status = error.statusCode || 500;

//   const response = {
//     error: error.statusCode
//       ? error.message
//       : fallbackMessage,
//   };

//   if (process.env.NODE_ENV !== 'production') {
//     response.details = error.message;
//   }

//   return {
//     status,
//     response,
//   };
// };

// const logError = (
//   label,
//   error
// ) => {
//   console.error(label, {
//     message: error.message,
//     stack: error.stack,
//     code: error.code,
//   });
// };


// // ─────────────────────────────────────────────
// // Controller
// // ─────────────────────────────────────────────

// const ChatMessageController = {
//   async createMessage(req, res) {
//     try {
//       const userId =
//         getAuthenticatedUserId(req);

//       const {
//         roomId,
//         text,
//         type,
//         mediaUrl,
//         thumbnailUrl,
//         blurhash,
//         fileName,
//         fileSize,
//         durationSec,
//         replyToId,
//         clientTempId,
//       } = req.body;

//       const roomIdInt = parsePositiveInt(
//         roomId,
//         'roomId'
//       );

//       if (!type) {
//         return res.status(400).json({
//           error: 'type is required',
//         });
//       }

//       const normalizedType =
//         String(type).toUpperCase();

//         const allowedTypes = [
//           'TEXT',
//           'IMAGE',
//           'VIDEO',
//           'AUDIO',
//           'FILE',
//         ];

//       if (
//         !allowedTypes.includes(normalizedType)
//       ) {
//         return res.status(400).json({
//           error: 'Invalid message type',
//         });
//       }

//       const normalizedText =
//         typeof text === 'string' &&
//         text.trim().length > 0
//           ? text.trim()
//           : null;

//       const normalizedMediaUrl =
//         typeof mediaUrl === 'string' &&
//         mediaUrl.trim().length > 0
//           ? mediaUrl.trim()
//           : null;

//       const normalizedThumbnailUrl =
//         typeof thumbnailUrl === 'string' &&
//         thumbnailUrl.trim().length > 0
//           ? thumbnailUrl.trim()
//           : null;

//       if (
//         ['IMAGE', 'VIDEO', 'FILE', 'AUDIO'].includes(
//           normalizedType
//         ) &&
//         !normalizedMediaUrl
//       ) {
//         return res.status(400).json({
//           error:
//             'mediaUrl is required for media messages',
//         });
//       }

//       if (
//         normalizedType === 'TEXT' &&
//         !normalizedText
//       ) {
//         return res.status(400).json({
//           error:
//             'text is required for text messages',
//         });
//       }

//       let generatedBlurhash = null;

//       /*
//        * Images are generated from the stored GCS URL.
//        * BlurHash generation is optional metadata and
//        * should not prevent the message from being sent.
//        */
//       if (
//         normalizedType === 'IMAGE' &&
//         normalizedMediaUrl
//       ) {
//         try {
//           generatedBlurhash =
//             await generateBlurHashFromImageUrl(
//               normalizedMediaUrl
//             );
//         } catch (error) {
//           logError(
//             'Image BlurHash generation failed',
//             error
//           );

//           generatedBlurhash = null;
//         }
//       }

//       /*
//        * Videos receive their BlurHash from the upload
//        * endpoint. The upload service generates it from
//        * the video thumbnail.
//        */
//       if (
//         normalizedType === 'VIDEO' &&
//         typeof blurhash === 'string' &&
//         blurhash.trim().length > 0
//       ) {
//         generatedBlurhash =
//           blurhash.trim();
//       }

//       const normalizedFileSize =
//         parseNullableNumber(
//           fileSize,
//           'fileSize'
//         );

//       const normalizedDurationSec =
//         parseNullableNumber(
//           durationSec,
//           'durationSec'
//         );

//       const normalizedReplyToId =
//         replyToId === undefined ||
//         replyToId === null ||
//         replyToId === ''
//           ? null
//           : parsePositiveInt(
//               replyToId,
//               'replyToId'
//             );

//       const newMessage =
//         await ChatMessageService.createMessage({
//           roomId: roomIdInt,
//           userId,

//           text:
//             normalizedType === 'TEXT'
//               ? normalizedText
//               : null,

//           type: normalizedType,
//           mediaUrl: normalizedMediaUrl,
//           thumbnailUrl:
//             normalizedThumbnailUrl,

//           blurhash: generatedBlurhash,

//           fileName:
//             typeof fileName === 'string' &&
//             fileName.trim().length > 0
//               ? fileName.trim()
//               : null,

//           fileSize: normalizedFileSize,
//           durationSec: normalizedDurationSec,
//           replyToId: normalizedReplyToId,

//           clientTempId:
//             typeof clientTempId === 'string' &&
//             clientTempId.trim().length > 0
//               ? clientTempId.trim()
//               : null,
//         });

//       const io = req.app.get('io');

//       if (io) {
//         io.to(`room:${roomIdInt}`).emit(
//           'message:new',
//           {
//             message: newMessage,
//             tempId: clientTempId || null,
//           }
//         );

//         const members =
//           await prisma.chatRoomMember.findMany({
//             where: {
//               roomId: roomIdInt,
//             },
//             select: {
//               userId: true,
//               lastReadSeq: true,
//             },
//           });

//         members.forEach((member) => {
//           io.to(`user:${member.userId}`).emit(
//             'conversation:updated',
//             {
//               roomId: roomIdInt,
//               lastMessage: newMessage,
//               unreadCount: Math.max(
//                 0,
//                 newMessage.seq -
//                   member.lastReadSeq
//               ),
//             }
//           );
//         });
//       }

//       return res.status(201).json({
//         message: 'Message sent successfully',
//         data: newMessage,
//       });
//     } catch (error) {
//       logError(
//         'Create message failed',
//         error
//       );

//       const {
//         status,
//         response,
//       } = getErrorResponse(
//         error,
//         'Failed to create message'
//       );

//       return res.status(status).json(response);
//     }
//   },

//   async uploadMedia(req, res) {
//     try {
//       const userId =
//         getAuthenticatedUserId(req);

//       const roomId =
//         parsePositiveInt(
//           req.body?.roomId,
//           'roomId'
//         );

//       const mediaFile =
//         req.files?.media?.[0] ||
//         req.file ||
//         null;

//       if (!mediaFile) {
//         return res.status(400).json({
//           error: 'media file is required',
//         });
//       }

//       const result =
//         await ChatMessageService.uploadMediaOnly({
//           roomId,
//           userId,
//           file: mediaFile,
//         });

//       return res.status(200).json({
//         message: 'Media uploaded successfully',
//         data: {
//           url: result.url,
//           thumbnailUrl:
//             result.thumbnailUrl ?? null,

//           /*
//            * This will contain the video BlurHash
//            * returned by multer/uploadMediaToGCS.
//            */
//           blurhash:
//             result.blurhash ?? null,

//           mediaType: result.mediaType,
//           fileName: result.fileName,
//           fileSize: result.fileSize,
//           durationSec:
//             result.durationSec ?? null,
//         },
//       });
//     } catch (error) {
//       logError(
//         'Media upload failed',
//         error
//       );

//       const {
//         status,
//         response,
//       } = getErrorResponse(
//         error,
//         'Failed to upload media'
//       );

//       return res.status(status).json(response);
//     }
//   },

//   async getMessages(req, res) {
//     try {
//       const userId =
//         getAuthenticatedUserId(req);

//       const roomId =
//         parsePositiveInt(
//           req.query.roomId,
//           'roomId'
//         );

//       const result =
//         await ChatMessageService.getMessages({
//           roomId,
//           userId,
//           page: req.query.page || 1,
//           limit: req.query.limit || 20,
//         });

//       return res.status(200).json(result);
//     } catch (error) {
//       logError(
//         'Get messages failed',
//         error
//       );

//       const {
//         status,
//         response,
//       } = getErrorResponse(
//         error,
//         'Failed to fetch messages'
//       );

//       return res.status(status).json(response);
//     }
//   },

//   async getMessagesByCursor(req, res) {
//     try {
//       const userId =
//         getAuthenticatedUserId(req);

//       const roomId =
//         parsePositiveInt(
//           req.params.roomId,
//           'roomId'
//         );

//       const {
//         cursor,
//         limit = 30,
//       } = req.query;

//       const result =
//         await ChatMessageService.getMessagesByCursor({
//           roomId,
//           userId,
//           cursor,
//           limit,
//         });

//       return res.status(200).json(result);
//     } catch (error) {
//       logError(
//         'Get messages by cursor failed',
//         error
//       );

//       const {
//         status,
//         response,
//       } = getErrorResponse(
//         error,
//         'Failed to fetch messages'
//       );

//       return res.status(status).json(response);
//     }
//   },

//   async getMessageById(req, res) {
//     try {
//       const id =
//         parsePositiveInt(
//           req.params.id,
//           'message ID'
//         );

//       const userId =
//         getAuthenticatedUserId(req);

//       const message =
//         await ChatMessageService.getMessageById(
//           id,
//           userId
//         );

//       return res.status(200).json({
//         data: message,
//       });
//     } catch (error) {
//       logError(
//         'Get message failed',
//         error
//       );

//       const {
//         status,
//         response,
//       } = getErrorResponse(
//         error,
//         'Failed to fetch message'
//       );

//       return res.status(status).json(response);
//     }
//   },

//   async updateMessage(req, res) {
//     try {
//       const id =
//         parsePositiveInt(
//           req.params.id,
//           'message ID'
//         );

//       const userId =
//         getAuthenticatedUserId(req);

//       const {
//         text,
//       } = req.body;

//       const updated =
//         await ChatMessageService.updateMessage(
//           id,
//           userId,
//           { text }
//         );

//       const io = req.app.get('io');

//       if (io) {
//         io.to(`room:${updated.roomId}`).emit(
//           'message:updated',
//           {
//             message: updated,
//           }
//         );
//       }

//       return res.status(200).json({
//         message: 'Message updated successfully',
//         data: updated,
//       });
//     } catch (error) {
//       logError(
//         'Update message failed',
//         error
//       );

//       const {
//         status,
//         response,
//       } = getErrorResponse(
//         error,
//         'Failed to update message'
//       );

//       return res.status(status).json(response);
//     }
//   },

//   async deleteMessage(req, res) {
//     try {
//       const id =
//         parsePositiveInt(
//           req.params.id,
//           'message ID'
//         );

//       const userId =
//         getAuthenticatedUserId(req);

//       const scope =
//         req.body?.scope ||
//         req.query?.scope ||
//         'everyone';

//       if (
//         !['everyone', 'me'].includes(scope)
//       ) {
//         return res.status(400).json({
//           error: 'Invalid delete scope',
//         });
//       }

//       const existing =
//         await prisma.chatMessage.findUnique({
//           where: { id },
//           select: { roomId: true },
//         });

//       if (!existing) {
//         return res.status(404).json({
//           error: 'Message not found',
//         });
//       }

//       await ChatMessageService.deleteMessage(
//         id,
//         userId,
//         scope
//       );

//       const io = req.app.get('io');

//       if (io) {
//         if (scope === 'everyone') {
//           io.to(`room:${existing.roomId}`).emit(
//             'message:deleted',
//             {
//               messageId: id,
//               roomId: existing.roomId,
//               scope: 'everyone',
//             }
//           );
//         } else {
//           io.to(`user:${userId}`).emit(
//             'message:deleted',
//             {
//               messageId: id,
//               roomId: existing.roomId,
//               scope: 'me',
//               userId,
//             }
//           );
//         }
//       }

//       return res.status(200).json({
//         message:
//           scope === 'everyone'
//             ? 'Message deleted for everyone'
//             : 'Message deleted for you',

//         data: {
//           messageId: id,
//           roomId: existing.roomId,
//           scope,
//         },
//       });
//     } catch (error) {
//       logError(
//         'Delete message failed',
//         error
//       );

//       const {
//         status,
//         response,
//       } = getErrorResponse(
//         error,
//         'Failed to delete message'
//       );

//       return res.status(status).json(response);
//     }
//   },

//   async markRead(req, res) {
//     try {
//       const userId =
//         getAuthenticatedUserId(req);

//       const roomId =
//         parsePositiveInt(
//           req.params.roomId,
//           'roomId'
//         );

//       const upToSeq =
//         parsePositiveInt(
//           req.body?.upToSeq,
//           'upToSeq'
//         );

//       const result =
//         await ChatMessageService.markRead({
//           roomId,
//           userId,
//           upToSeq,
//         });

//       const io = req.app.get('io');

//       if (io && result.updated > 0) {
//         io.to(`room:${roomId}`).emit(
//           'message:statusUpdate',
//           {
//             roomId,
//             messageIds: result.messageIds,
//             status: 'READ',
//             userId,
//           }
//         );

//         io.to(`user:${userId}`).emit(
//           'conversation:updated',
//           {
//             roomId,
//             unreadCount: 0,
//           }
//         );
//       }

//       return res.status(200).json(result);
//     } catch (error) {
//       logError(
//         'Mark messages read failed',
//         error
//       );

//       const {
//         status,
//         response,
//       } = getErrorResponse(
//         error,
//         'Failed to mark messages as read'
//       );

//       return res.status(status).json(response);
//     }
//   },

//   async markDelivered(req, res) {
//     try {
//       const userId =
//         getAuthenticatedUserId(req);

//       const roomId =
//         parsePositiveInt(
//           req.params.roomId,
//           'roomId'
//         );

//       const {
//         messageIds,
//       } = req.body;

//       const result =
//         await ChatMessageService.markDelivered({
//           roomId,
//           userId,
//           messageIds,
//         });

//       const io = req.app.get('io');

//       if (io && result.updated > 0) {
//         io.to(`room:${roomId}`).emit(
//           'message:statusUpdate',
//           {
//             roomId,
//             messageIds,
//             status: 'DELIVERED',
//             userId,
//           }
//         );
//       }

//       return res.status(200).json(result);
//     } catch (error) {
//       logError(
//         'Mark messages delivered failed',
//         error
//       );

//       const {
//         status,
//         response,
//       } = getErrorResponse(
//         error,
//         'Failed to mark messages as delivered'
//       );

//       return res.status(status).json(response);
//     }
//   },

//   async searchMessages(req, res) {
//     try {
//       const userId =
//         getAuthenticatedUserId(req);

//       const roomId =
//         parsePositiveInt(
//           req.params.roomId,
//           'roomId'
//         );

//       const query =
//         typeof req.query.q === 'string'
//           ? req.query.q.trim()
//           : '';

//       if (!query) {
//         return res.status(400).json({
//           error: 'Search query is required',
//         });
//       }

//       const result =
//         await ChatMessageService.searchMessages({
//           roomId,
//           userId,
//           query,
//           page: req.query.page || 1,
//           limit: req.query.limit || 20,
//         });

//       return res.status(200).json(result);
//     } catch (error) {
//       logError(
//         'Search messages failed',
//         error
//       );

//       const {
//         status,
//         response,
//       } = getErrorResponse(
//         error,
//         'Failed to search messages'
//       );

//       return res.status(status).json(response);
//     }
//   },

//   async getMessagesSince(req, res) {
//     try {
//       const userId =
//         getAuthenticatedUserId(req);

//       const roomId =
//         parsePositiveInt(
//           req.params.roomId,
//           'roomId'
//         );

//       if (
//         req.query.sinceSeq === undefined
//       ) {
//         return res.status(400).json({
//           error: 'sinceSeq is required',
//         });
//       }

//       const sinceSeq =
//         parsePositiveInt(
//           req.query.sinceSeq,
//           'sinceSeq'
//         );

//       const result =
//         await ChatMessageService.getMessagesSince({
//           roomId,
//           userId,
//           sinceSeq,
//         });

//       return res.status(200).json(result);
//     } catch (error) {
//       logError(
//         'Get messages since failed',
//         error
//       );

//       const {
//         status,
//         response,
//       } = getErrorResponse(
//         error,
//         'Failed to fetch messages since'
//       );

//       return res.status(status).json(response);
//     }
//   },

//   async getUpdatedMessagesSince(req, res) {
//     try {
//       const userId =
//         getAuthenticatedUserId(req);

//       const roomId =
//         parsePositiveInt(
//           req.params.roomId,
//           'roomId'
//         );

//       const {
//         since,
//       } = req.query;

//       if (!since) {
//         return res.status(400).json({
//           error: 'since is required',
//         });
//       }

//       const sinceDate =
//         new Date(since);

//       if (
//         Number.isNaN(
//           sinceDate.getTime()
//         )
//       ) {
//         return res.status(400).json({
//           error: 'since must be a valid date',
//         });
//       }

//       const result =
//         await ChatMessageService
//           .getUpdatedMessagesSince({
//             roomId,
//             userId,
//             since: sinceDate.toISOString(),
//           });

//       return res.status(200).json(result);
//     } catch (error) {
//       logError(
//         'Get updated messages failed',
//         error
//       );

//       const {
//         status,
//         response,
//       } = getErrorResponse(
//         error,
//         'Failed to fetch updated messages'
//       );

//       return res.status(status).json(response);
//     }
//   },
// };

// export default ChatMessageController;



