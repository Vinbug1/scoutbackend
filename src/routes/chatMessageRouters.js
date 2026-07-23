import express from 'express';
import chatMessageController from '../controllers/chatMessageController.js';
import { verifyToken as  protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *
 *     #############################################
 *     # User
 *     #############################################
 *
 *     ChatUser:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 12
 *         fullname:
 *           type: string
 *           example: John Doe
 *         email:
 *           type: string
 *           example: john@example.com
 *
 *     #############################################
 *     # Chat Room
 *     #############################################
 *
 *     ChatRoom:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 5
 *         name:
 *           type: string
 *           example: General Chat
 *
 *     #############################################
 *     # Reply Preview
 *     #############################################
 *
 *     ReplyMessage:
 *       type: object
 *       nullable: true
 *       properties:
 *         id:
 *           type: integer
 *           example: 120
 *         text:
 *           type: string
 *           nullable: true
 *           example: Hello everyone
 *         type:
 *           type: string
 *           enum:
 *             - TEXT
 *             - IMAGE
 *             - VIDEO
 *             - FILE
 *         userId:
 *           type: integer
 *           example: 22
 *
 *     #############################################
 *     # Chat Message
 *     #############################################
 *
 *     ChatMessage:
 *       type: object
 *       properties:
 *
 *         id:
 *           type: integer
 *           example: 501
 *
 *         roomId:
 *           type: integer
 *           example: 8
 *
 *         userId:
 *           type: integer
 *           example: 17
 *
 *         seq:
 *           type: integer
 *           description: Monotonically increasing room sequence number.
 *           example: 325
 *
 *         text:
 *           type: string
 *           nullable: true
 *           example: Hello world
 *
 *         type:
 *           type: string
 *           enum:
 *             - TEXT
 *             - IMAGE
 *             - VIDEO
 *             - FILE
 *
 *         status:
 *           type: string
 *           description: Derived sender-facing delivery status.
 *           enum:
 *             - SENT
 *             - DELIVERED
 *             - READ
 *
 *         mediaUrl:
 *           type: string
 *           nullable: true
 *           example: https://cdn.example.com/image.jpg
 *
 *         thumbnailUrl:
 *           type: string
 *           nullable: true
 *
 *         fileName:
 *           type: string
 *           nullable: true
 *           example: holiday-photo.jpg
 *
 *         fileSize:
 *           type: integer
 *           nullable: true
 *           example: 852133
 *
 *         durationSec:
 *           type: integer
 *           nullable: true
 *           example: 38
 *
 *         replyToId:
 *           type: integer
 *           nullable: true
 *
 *         replyToPreview:
 *           type: string
 *           nullable: true
 *           example: Hello everyone
 *
 *         replyToSenderId:
 *           type: integer
 *           nullable: true
 *
 *         clientTempId:
 *           type: string
 *           nullable: true
 *           example: temp_123456789
 *
 *         editedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *         deletedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *         sentAt:
 *           type: string
 *           format: date-time
 *
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *         user:
 *           $ref: '#/components/schemas/ChatUser'
 *
 *         room:
 *           $ref: '#/components/schemas/ChatRoom'
 *
 *         replyTo:
 *           $ref: '#/components/schemas/ReplyMessage'
 *
 *     #############################################
 *     # Create Message
 *     #############################################
 *
 *     MessageInput:
 *       type: object
 *       required:
 *         - roomId
 *         - userId
 *       properties:
 *
 *         roomId:
 *           type: integer
 *           example: 3
 *
 *         userId:
 *           type: integer
 *           example: 17
 *
 *         text:
 *           type: string
 *           description: Required when type=TEXT
 *           example: Hello everyone
 *
 *         type:
 *           type: string
 *           default: TEXT
 *           enum:
 *             - TEXT
 *             - IMAGE
 *             - VIDEO
 *             - FILE
 *
 *         mediaUrl:
 *           type: string
 *           description: Required for IMAGE, VIDEO and FILE messages.
 *
 *         thumbnailUrl:
 *           type: string
 *
 *         fileName:
 *           type: string
 *
 *         fileSize:
 *           type: integer
 *
 *         durationSec:
 *           type: integer
 *
 *         replyToId:
 *           type: integer
 *
 *         clientTempId:
 *           type: string
 *           description: Client-generated id used for idempotent retries.
 *
 *     #############################################
 *     # Update Message
 *     #############################################
 *
 *     MessageUpdate:
 *       type: object
 *       required:
 *         - text
 *       properties:
 *         text:
 *           type: string
 *           example: Updated message
 *
 *     #############################################
 *     # Delete Message
 *     #############################################
 *
 *     DeleteMessage:
 *       type: object
 *       properties:
 *         scope:
 *           type: string
 *           enum:
 *             - everyone
 *             - me
 *           default: everyone
 *
 *     #############################################
 *     # Mark Read
 *     #############################################
 *
 *     MarkReadInput:
 *       type: object
 *       required:
 *         - userId
 *         - upToSeq
 *       properties:
 *         userId:
 *           type: integer
 *           example: 12
 *         upToSeq:
 *           type: integer
 *           description: Highest room sequence number read.
 *           example: 215
 *
 *     #############################################
 *     # Mark Delivered
 *     #############################################
 *
 *     MarkDeliveredInput:
 *       type: object
 *       required:
 *         - userId
 *         - messageIds
 *       properties:
 *         userId:
 *           type: integer
 *           example: 15
 *         messageIds:
 *           type: array
 *           items:
 *             type: integer
 *           example:
 *             - 11
 *             - 12
 *             - 13
 *
 *     #############################################
 *     # Pagination Metadata
 *     #############################################
 *
 *     PaginationMeta:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *         page:
 *           type: integer
 *         limit:
 *           type: integer
 *         totalPages:
 *           type: integer
 *
 *     #############################################
 *     # Message List
 *     #############################################
 *
 *     MessageListResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChatMessage'
 *         meta:
 *           $ref: '#/components/schemas/PaginationMeta'
 *
 *     #############################################
 *     # Cursor Response
 *     #############################################
 *
 *     CursorMessageResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChatMessage'
 *         nextCursor:
 *           type: integer
 *           nullable: true
 *
 *     #############################################
 *     # Since Response
 *     #############################################
 *
 *     MessagesSinceResponse:
 *       type: object
 *       properties:
 *         messages:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChatMessage'
 *         truncated:
 *           type: boolean
 *
 *     #############################################
 *     # Updated Messages
 *     #############################################
 *
 *     UpdatedMessage:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         seq:
 *           type: integer
 *         text:
 *           type: string
 *           nullable: true
 *         mediaUrl:
 *           type: string
 *           nullable: true
 *         editedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         deletedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     UpdatedMessagesResponse:
 *       type: object
 *       properties:
 *         updated:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/UpdatedMessage'
 *         truncated:
 *           type: boolean
 *
 *     #############################################
 *     # Generic Success
 *     #############################################
 *
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *
 *     #############################################
 *     # Generic Error
 *     #############################################
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: You are not a member of this room
 *         statusCode:
 *           type: integer
 *           example: 403
 */
/**
 * @swagger
 * tags:
 *   name: ChatMessages
 *   description: Chat message management API
 */

/**
 * @swagger
 * /chatMessages:
 *   post:
 *     summary: Send a new chat message
 *     description: |
 *       Sends a new message to a chat room.
 *
 *       Supported message types:
 *
 *       • TEXT
 *       • IMAGE
 *       • VIDEO
 *       • FILE
 *
 *       Rules:
 *
 *       - Sender must belong to the room.
 *       - Sender cannot message blocked users.
 *       - TEXT messages require the `text` field.
 *       - IMAGE/VIDEO/FILE messages require `mediaUrl`.
 *       - `replyToId` is validated to ensure it belongs to the same room.
 *         Invalid reply IDs are ignored rather than causing the request to fail.
 *       - Duplicate retries are handled automatically using `clientTempId`.
 *
 *     operationId: createChatMessage
 *
 *     tags:
 *       - ChatMessages
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MessageInput'
 *           examples:
 *
 *             textMessage:
 *               summary: Send a text message
 *               value:
 *                 roomId: 12
 *                 userId: 8
 *                 text: Hello everyone 👋
 *                 type: TEXT
 *                 clientTempId: temp-1699452100
 *
 *             imageMessage:
 *               summary: Send an image
 *               value:
 *                 roomId: 12
 *                 userId: 8
 *                 type: IMAGE
 *                 mediaUrl: https://cdn.example.com/images/pic.jpg
 *                 thumbnailUrl: https://cdn.example.com/thumbs/pic.jpg
 *                 fileName: holiday.jpg
 *                 fileSize: 245682
 *                 clientTempId: temp-1699452101
 *
 *             videoMessage:
 *               summary: Send a video
 *               value:
 *                 roomId: 12
 *                 userId: 8
 *                 type: VIDEO
 *                 mediaUrl: https://cdn.example.com/videos/video.mp4
 *                 thumbnailUrl: https://cdn.example.com/videos/thumb.jpg
 *                 durationSec: 58
 *                 fileSize: 8521263
 *                 clientTempId: temp-1699452102
 *
 *             fileMessage:
 *               summary: Send a document
 *               value:
 *                 roomId: 12
 *                 userId: 8
 *                 type: FILE
 *                 mediaUrl: https://cdn.example.com/files/report.pdf
 *                 fileName: report.pdf
 *                 fileSize: 1048576
 *                 clientTempId: temp-1699452103
 *
 *             replyMessage:
 *               summary: Reply to another message
 *               value:
 *                 roomId: 12
 *                 userId: 8
 *                 text: I agree completely.
 *                 replyToId: 315
 *                 type: TEXT
 *                 clientTempId: temp-1699452104
 *
 *     responses:
 *
 *       201:
 *         description: Message successfully created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatMessage'
 *             example:
 *               id: 514
 *               roomId: 12
 *               userId: 8
 *               seq: 431
 *               text: Hello everyone 👋
 *               type: TEXT
 *               status: SENT
 *               mediaUrl: null
 *               thumbnailUrl: null
 *               fileName: null
 *               fileSize: null
 *               durationSec: null
 *               replyToId: null
 *               replyToPreview: null
 *               replyToSenderId: null
 *               clientTempId: temp-1699452100
 *               editedAt: null
 *               deletedAt: null
 *               sentAt: "2026-07-16T08:30:55.342Z"
 *               updatedAt: "2026-07-16T08:30:55.342Z"
 *               user:
 *                 id: 8
 *                 fullname: John Doe
 *                 email: john@example.com
 *               room:
 *                 id: 12
 *                 name: General Chat
 *               replyTo: null
 *
 *       400:
 *         description: Invalid request.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *
 *               emptyText:
 *                 value:
 *                   success: false
 *                   error: Message content is required for text messages
 *                   statusCode: 400
 *
 *               missingMedia:
 *                 value:
 *                   success: false
 *                   error: mediaUrl is required for media messages
 *                   statusCode: 400
 *
 *       403:
 *         description: User cannot send messages.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *
 *               notMember:
 *                 value:
 *                   success: false
 *                   error: You are not a member of this room
 *                   statusCode: 403
 *
 *               blocked:
 *                 value:
 *                   success: false
 *                   error: Cannot send messages to this user
 *                   statusCode: 403
 *
 *       404:
 *         description: Chat room does not exist.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: Chat room not found
 *               statusCode: 404
 *
 *       500:
 *         description: Unexpected server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', protect, chatMessageController.createMessage );

/**
 * @swagger
 * /chatMessages:
 *   get:
 *     summary: Get chat messages using offset pagination
 *     description: |
 *       Returns messages from a chat room using classic
 *       page/limit pagination.
 *
 *       Only messages that:
 *
 *       - belong to the room
 *       - are not deleted globally
 *       - have not been deleted for the requesting user
 *
 *       are returned.
 *
 *       The sender's message status
 *       (SENT / DELIVERED / READ)
 *       is computed dynamically.
 *
 *     operationId: getChatMessages
 *
 *     tags:
 *       - ChatMessages
 *
 *     parameters:
 *
 *       - in: query
 *         name: roomId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Chat room id.
 *         example: 8
 *
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Requesting user.
 *         example: 15
 *
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         example: 1
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         example: 20
 *
 *     responses:
 *
 *       200:
 *         description: Messages successfully retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageListResponse'
 *
 *             example:
 *
 *               data:
 *
 *                 - id: 510
 *                   roomId: 8
 *                   userId: 17
 *                   seq: 300
 *                   text: Hello
 *                   type: TEXT
 *                   status: READ
 *                   mediaUrl: null
 *                   sentAt: "2026-07-16T09:10:12.000Z"
 *
 *                 - id: 511
 *                   roomId: 8
 *                   userId: 18
 *                   seq: 301
 *                   text: Hi John
 *                   type: TEXT
 *                   status: SENT
 *                   mediaUrl: null
 *                   sentAt: "2026-07-16T09:10:55.000Z"
 *
 *               meta:
 *                 total: 253
 *                 page: 1
 *                 limit: 20
 *                 totalPages: 13
 *
 *       403:
 *         description: User is not a room participant.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       500:
 *         description: Server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/',protect,  chatMessageController.getMessages );

/**
 * @swagger
 * /api/chatMessages/room/{roomId}/cursor:
 *   get:
 *     summary: Get messages using cursor pagination
 *     description: |
 *       Returns messages for infinite scrolling.
 *
 *       Cursor pagination is based on the room sequence number (`seq`)
 *       rather than the message id.
 *
 *       The endpoint returns messages ordered from oldest
 *       to newest.
 *
 *       If `nextCursor` is null,
 *       there are no older messages.
 *
 *     operationId: getMessagesByCursor
 *
 *     tags:
 *       - ChatMessages
 *
 *     parameters:
 *
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 8
 *
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 17
 *
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: integer
 *         description: |
 *           Room sequence number.
 *
 *           Only messages whose sequence number is
 *           less than this value will be returned.
 *
 *         example: 520
 *
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 30
 *         example: 30
 *
 *     responses:
 *
 *       200:
 *         description: Cursor page retrieved successfully.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/CursorMessageResponse'
 *
 *             example:
 *
 *               data:
 *
 *                 - id: 471
 *                   roomId: 8
 *                   userId: 14
 *                   seq: 485
 *                   text: Good morning
 *                   type: TEXT
 *                   status: READ
 *
 *                 - id: 472
 *                   roomId: 8
 *                   userId: 17
 *                   seq: 486
 *                   text: Morning 👋
 *                   type: TEXT
 *                   status: READ
 *
 *                 - id: 473
 *                   roomId: 8
 *                   userId: 14
 *                   seq: 487
 *                   text: Let's begin.
 *                   type: TEXT
 *                   status: DELIVERED
 *
 *               nextCursor: 485
 *
 *       403:
 *         description: User is not a room member.
 *
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       500:
 *         description: Internal server error.
 *
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/room/:roomId/cursor', protect, chatMessageController.getMessagesByCursor );

/**
 * @swagger
 * /api/chatMessages/room/{roomId}/search:
 *   get:
 *     summary: Search messages inside a chat room
 *     description: |
 *       Searches text messages within a specific chat room.
 *
 *       Search is case-insensitive.
 *
 *       Only messages that:
 *
 *       - belong to the room
 *       - are not globally deleted
 *       - have not been deleted for the requesting user
 *
 *       are returned.
 *
 *       Results are ordered by the newest messages first.
 *
 *     operationId: searchChatMessages
 *
 *     tags:
 *       - ChatMessages
 *
 *     parameters:
 *
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 7
 *
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 15
 *
 *       - in: query
 *         name: q
 *         required: true
 *         description: Text to search.
 *         schema:
 *           type: string
 *         example: meeting
 *
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         example: 1
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         example: 20
 *
 *     responses:
 *
 *       200:
 *         description: Matching messages found.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/MessageListResponse'
 *
 *             example:
 *
 *               data:
 *
 *                 - id: 450
 *                   roomId: 7
 *                   userId: 12
 *                   seq: 280
 *                   text: The meeting starts by 10am.
 *                   type: TEXT
 *                   status: READ
 *                   sentAt: "2026-07-16T08:20:00.000Z"
 *
 *                 - id: 451
 *                   roomId: 7
 *                   userId: 18
 *                   seq: 281
 *                   text: Meeting postponed until tomorrow.
 *                   type: TEXT
 *                   status: READ
 *                   sentAt: "2026-07-16T09:10:11.000Z"
 *
 *               meta:
 *                 total: 2
 *                 page: 1
 *                 limit: 20
 *                 totalPages: 1
 *
 *       400:
 *         description: Invalid search request.
 *
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *             examples:
 *
 *               missingQuery:
 *                 value:
 *                   success: false
 *                   error: Search query is required
 *                   statusCode: 400
 *
 *       403:
 *         description: User is not a member of the room.
 *
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *             example:
 *               success: false
 *               error: You are not a member of this room
 *               statusCode: 403
 *
 *       500:
 *         description: Unexpected server error.
 *
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/room/:roomId/search',protect,  chatMessageController.searchMessages );

/**
 * @swagger
 * /api/chatMessages/{id}:
 *   get:
 *     summary: Get a single chat message
 *     description: |
 *       Retrieves a chat message by its unique identifier.
 *
 *       The requesting user **must currently be a participant**
 *       in the room containing the message.
 *
 *       Deleted messages are treated as non-existent and return **404**.
 *
 *     operationId: getChatMessageById
 *
 *     tags:
 *       - ChatMessages
 *
 *     parameters:
 *
 *       - in: path
 *         name: id
 *         required: true
 *         description: Message ID.
 *         schema:
 *           type: integer
 *         example: 512
 *
 *       - in: query
 *         name: userId
 *         required: true
 *         description: Requesting user's ID.
 *         schema:
 *           type: integer
 *         example: 15
 *
 *     responses:
 *
 *       200:
 *         description: Message retrieved successfully.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ChatMessage'
 *
 *             example:
 *
 *               id: 512
 *               roomId: 8
 *               userId: 17
 *               seq: 431
 *               text: Good morning everyone
 *               type: TEXT
 *               status: READ
 *               mediaUrl: null
 *               thumbnailUrl: null
 *               fileName: null
 *               fileSize: null
 *               durationSec: null
 *               replyToId: null
 *               replyToPreview: null
 *               replyToSenderId: null
 *               clientTempId: temp-1699452100
 *               editedAt: null
 *               deletedAt: null
 *               sentAt: "2026-07-16T08:30:55.342Z"
 *               updatedAt: "2026-07-16T08:30:55.342Z"
 *
 *               user:
 *                 id: 17
 *                 fullname: John Doe
 *                 email: john@example.com
 *
 *               room:
 *                 id: 8
 *                 name: General Chat
 *
 *               replyTo: null
 *
 *       403:
 *         description: User is not a participant of the room.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *             example:
 *               success: false
 *               error: You are not a member of this room
 *               statusCode: 403
 *
 *       404:
 *         description: Message not found or has been deleted.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *             examples:
 *
 *               notFound:
 *                 value:
 *                   success: false
 *                   error: Message not found
 *                   statusCode: 404
 *
 *               deleted:
 *                 value:
 *                   success: false
 *                   error: Message not found
 *                   statusCode: 404
 *
 *       500:
 *         description: Unexpected server error.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get( '/:id', protect, chatMessageController.getMessageById );

/**
 * @swagger
 * /api/chatMessages/{id}:
 *   put:
 *     summary: Edit a text message
 *     description: |
 *       Updates the text of an existing chat message.
 *
 *       Business rules:
 *
 *       - Only the original sender may edit.
 *       - Only TEXT messages may be edited.
 *       - Editing is allowed only within 15 minutes of sending.
 *       - The sender must still be a current participant of the room.
 *       - Deleted messages cannot be edited.
 *       - Editing automatically updates the room preview if the edited
 *         message is currently the room's latest message.
 *
 *     operationId: updateChatMessage
 *
 *     tags:
 *       - ChatMessages
 *
 *     parameters:
 *
 *       - in: path
 *         name: id
 *         required: true
 *         description: Message ID.
 *         schema:
 *           type: integer
 *         example: 514
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *
 *           schema:
 *             $ref: '#/components/schemas/MessageUpdate'
 *
 *           example:
 *             text: Good morning everyone ☀️
 *
 *     responses:
 *
 *       200:
 *         description: Message updated successfully.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ChatMessage'
 *
 *             example:
 *
 *               id: 514
 *               roomId: 12
 *               userId: 8
 *               seq: 431
 *               text: Good morning everyone ☀️
 *               type: TEXT
 *               status: READ
 *               editedAt: "2026-07-16T09:30:18.000Z"
 *               deletedAt: null
 *               sentAt: "2026-07-16T09:15:05.000Z"
 *               updatedAt: "2026-07-16T09:30:18.000Z"
 *
 *       400:
 *         description: Invalid edit request.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *             examples:
 *
 *               emptyText:
 *                 value:
 *                   success: false
 *                   error: Message text is required
 *                   statusCode: 400
 *
 *               mediaMessage:
 *                 value:
 *                   success: false
 *                   error: Only text messages can be edited
 *                   statusCode: 400
 *
 *               expiredWindow:
 *                 value:
 *                   success: false
 *                   error: Edit window has expired
 *                   statusCode: 400
 *
 *       403:
 *         description: User is not allowed to edit the message.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *             examples:
 *
 *               notOwner:
 *                 value:
 *                   success: false
 *                   error: You can only edit your own messages
 *                   statusCode: 403
 *
 *               notMember:
 *                 value:
 *                   success: false
 *                   error: You are not a member of this room
 *                   statusCode: 403
 *
 *       404:
 *         description: Message not found.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *             example:
 *               success: false
 *               error: Message not found
 *               statusCode: 404
 *
 *       500:
 *         description: Internal server error.
 *
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/:id', protect, chatMessageController.updateMessage );

/**
 * @swagger
 * /api/chatMessages/{id}:
 *   delete:
 *     summary: Delete a chat message
 *     description: |
 *       Deletes a chat message.
 *
 *       Two deletion scopes are supported:
 *
 *       ## everyone
 *
 *       Removes the message for all participants.
 *
 *       Rules:
 *
 *       - Only the original sender may delete.
 *       - Must be within six hours of sending.
 *       - Does not require the sender to still belong to the room.
 *
 *       ## me
 *
 *       Removes the message only from the requesting user's view.
 *
 *       Rules:
 *
 *       - Message remains visible to everyone else.
 *       - Requires current room membership.
 *
 *     operationId: deleteChatMessage
 *
 *     tags:
 *       - ChatMessages
 *
 *     parameters:
 *
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 511
 *
 *       - in: query
 *         name: scope
 *         required: false
 *         description: |
 *           Deletion scope.
 *
 *           everyone = delete for all participants.
 *
 *           me = delete only for requesting user.
 *         schema:
 *           type: string
 *           default: everyone
 *           enum:
 *             - everyone
 *             - me
 *
 *     responses:
 *
 *       200:
 *         description: Message deleted successfully.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *
 *             examples:
 *
 *               deleteForEveryone:
 *                 value:
 *                   success: true
 *
 *               deleteForMe:
 *                 value:
 *                   success: true
 *
 *       400:
 *         description: Invalid delete request.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *             examples:
 *
 *               expired:
 *                 value:
 *                   success: false
 *                   error: Delete window has expired
 *                   statusCode: 400
 *
 *               invalidScope:
 *                 value:
 *                   success: false
 *                   error: Invalid delete scope
 *                   statusCode: 400
 *
 *       403:
 *         description: User is not permitted to delete.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *             examples:
 *
 *               notOwner:
 *                 value:
 *                   success: false
 *                   error: You can only delete your own messages
 *                   statusCode: 403
 *
 *               notMember:
 *                 value:
 *                   success: false
 *                   error: You are not a member of this room
 *                   statusCode: 403
 *
 *       404:
 *         description: Message not found.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *             example:
 *               success: false
 *               error: Message not found
 *               statusCode: 404
 *
 *       500:
 *         description: Internal server error.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id', protect, chatMessageController.deleteMessage );

/**
 * @swagger
 * /chatMessages/{roomId}/read:
 *   patch:
 *     summary: Mark messages as read
 *     description: |
 *       Marks every message in the room whose sequence number
 *       is less than or equal to `upToSeq` as read by the
 *       requesting user.
 *
 *       This endpoint:
 *
 *       - Updates the member's lastReadSeq.
 *       - Creates MessageRead records.
 *       - Prevents stale read events from moving the read
 *         cursor backwards.
 *       - Does NOT directly update ChatMessage.status.
 *         Delivery status is computed dynamically.
 *
 *     operationId: markMessagesRead
 *
 *     tags:
 *       - ChatMessages
 *
 *     parameters:
 *
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 8
 *
 *     requestBody:
 *       required: true
 *
 *       content:
 *         application/json:
 *
 *           schema:
 *             $ref: '#/components/schemas/MarkReadInput'
 *
 *           example:
 *             userId: 15
 *             upToSeq: 531
 *
 *     responses:
 *
 *       200:
 *         description: Messages marked as read.
 *
 *         content:
 *           application/json:
 *
 *             example:
 *               updated: 12
 *               messageIds:
 *                 - 511
 *                 - 512
 *                 - 513
 *                 - 514
 *
 *       400:
 *         description: Invalid request.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       403:
 *         description: User is not a room participant.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       500:
 *         description: Internal server error.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch('/:roomId/read',protect, chatMessageController.markRead );

/**
 * @swagger
 * /api/chatMessages/room/{roomId}/delivered:
 *   patch:
 *     summary: Mark messages as delivered
 *     description: |
 *       Records that one or more messages have reached the
 *       recipient's device.
 *
 *       Delivery is tracked per recipient using
 *       MessageDeliveryReceipt records.
 *
 *       This endpoint:
 *
 *       - Creates delivery receipts.
 *       - Updates ChatRoomMember.lastDeliveredSeq.
 *       - Does NOT modify ChatMessage.status.
 *
 *       Sender-facing delivery status is computed dynamically.
 *
 *     operationId: markMessagesDelivered
 *
 *     tags:
 *       - ChatMessages
 *
 *     parameters:
 *
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 8
 *
 *     requestBody:
 *       required: true
 *
 *       content:
 *         application/json:
 *
 *           schema:
 *             $ref: '#/components/schemas/MarkDeliveredInput'
 *
 *           example:
 *             userId: 21
 *             messageIds:
 *               - 451
 *               - 452
 *               - 453
 *
 *     responses:
 *
 *       200:
 *         description: Delivery receipts recorded.
 *
 *         content:
 *           application/json:
 *
 *             example:
 *               updated: 3
 *
 *       400:
 *         description: Invalid request.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       403:
 *         description: User is not a room participant.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       500:
 *         description: Unexpected server error.
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch( '/room/:roomId/delivered', protect, chatMessageController.markDelivered );

/**
 * @swagger
 * /api/chatMessages/room/{roomId}/since:
 *   get:
 *     summary: Get new messages since a sequence number
 *     description: |
 *       Returns all messages created after the supplied sequence number.
 *
 *       This endpoint is intended for clients reconnecting after being offline.
 *
 *       Results are limited to a maximum of 500 messages. If more messages
 *       exist, `truncated` will be `true`, indicating that the client should
 *       perform a full synchronization instead of relying on this response.
 *
 *     operationId: getMessagesSince
 *
 *     tags:
 *       - ChatMessages
 *
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         description: Chat room ID.
 *         schema:
 *           type: integer
 *         example: 12
 *
 *       - in: query
 *         name: userId
 *         required: true
 *         description: Current authenticated user.
 *         schema:
 *           type: integer
 *         example: 7
 *
 *       - in: query
 *         name: sinceSeq
 *         required: true
 *         description: Last sequence number received by the client.
 *         schema:
 *           type: integer
 *         example: 542
 *
 *     responses:
 *       200:
 *         description: New messages retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ChatMessage'
 *                 truncated:
 *                   type: boolean
 *                   description: Indicates whether the response exceeded the catch-up limit.
 *             example:
 *               messages:
 *                 - id: 600
 *                   roomId: 12
 *                   userId: 4
 *                   seq: 543
 *                   text: Hello everyone
 *                   type: TEXT
 *                   status: DELIVERED
 *                 - id: 601
 *                   roomId: 12
 *                   userId: 8
 *                   seq: 544
 *                   text: Welcome!
 *                   type: TEXT
 *                   status: READ
 *               truncated: false
 *
 *       403:
 *         description: User is not a member of the room.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       500:
 *         description: Internal server error.
 */
router.get('/room/:roomId/since', protect, chatMessageController.getMessagesSince );

/**
 * @swagger
 * /api/chatMessages/room/{roomId}/updates:
 *   get:
 *     summary: Get edited or deleted messages since a timestamp
 *     description: |
 *       Returns messages that were edited or deleted after the supplied
 *       timestamp.
 *
 *       This endpoint is used during client reconnection to synchronize
 *       message changes without downloading the full conversation.
 *
 *       Messages deleted only for the requesting user are automatically
 *       excluded from the response.
 *
 *       Results are limited to 500 rows. When `truncated` is true,
 *       the client should perform a complete resynchronization.
 *
 *     operationId: getUpdatedMessagesSince
 *
 *     tags:
 *       - ChatMessages
 *
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         description: Chat room ID.
 *         schema:
 *           type: integer
 *         example: 12
 *
 *       - in: query
 *         name: userId
 *         required: true
 *         description: Current authenticated user.
 *         schema:
 *           type: integer
 *         example: 7
 *
 *       - in: query
 *         name: since
 *         required: true
 *         description: ISO-8601 timestamp of the client's last synchronization.
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2026-07-16T10:30:00.000Z"
 *
 *     responses:
 *       200:
 *         description: Updated messages retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 updated:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       seq:
 *                         type: integer
 *                       text:
 *                         type: string
 *                         nullable: true
 *                       mediaUrl:
 *                         type: string
 *                         nullable: true
 *                       editedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       deletedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 truncated:
 *                   type: boolean
 *             example:
 *               updated:
 *                 - id: 601
 *                   seq: 544
 *                   text: Updated message
 *                   mediaUrl: null
 *                   editedAt: "2026-07-16T11:20:00.000Z"
 *                   deletedAt: null
 *                   updatedAt: "2026-07-16T11:20:00.000Z"
 *                 - id: 603
 *                   seq: 546
 *                   text: null
 *                   mediaUrl: null
 *                   editedAt: null
 *                   deletedAt: "2026-07-16T11:35:00.000Z"
 *                   updatedAt: "2026-07-16T11:35:00.000Z"
 *               truncated: false
 *
 *       403:
 *         description: User is not a member of the room.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       500:
 *         description: Internal server error.
 */
router.get( '/room/:roomId/updates', protect, chatMessageController.getUpdatedMessagesSince );


export default router;