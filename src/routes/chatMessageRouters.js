import express from 'express';
const router = express.Router();
import chatMessageController from '../controllers/chatMessageController.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     ChatMessage:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         roomId: { type: integer }
 *         userId: { type: integer }
 *         message: { type: string, nullable: true }
 *         type: { type: string, enum: [TEXT, IMAGE, VIDEO, FILE] }
 *         status: { type: string, enum: [SENT, DELIVERED, READ] }
 *         mediaUrl: { type: string, nullable: true }
 *         thumbnailUrl: { type: string, nullable: true }
 *         fileName: { type: string, nullable: true }
 *         fileSize: { type: integer, nullable: true }
 *         durationSec: { type: integer, nullable: true }
 *         replyToId: { type: integer, nullable: true }
 *         sentAt: { type: string, format: date-time }
 *
 *     MessageInput:
 *       type: object
 *       required: [roomId, userId]
 *       properties:
 *         roomId: { type: integer }
 *         userId: { type: integer }
 *         message: { type: string, description: "Required when type is TEXT" }
 *         type: { type: string, enum: [TEXT, IMAGE, VIDEO, FILE], default: TEXT }
 *         mediaUrl: { type: string, description: "Required when type is not TEXT" }
 *         thumbnailUrl: { type: string }
 *         fileName: { type: string }
 *         fileSize: { type: integer }
 *         durationSec: { type: integer }
 *         replyToId: { type: integer }
 *         clientTempId: { type: string, description: "Client-generated id for optimistic UI reconciliation" }
 *
 *     MessageUpdate:
 *       type: object
 *       required: [message]
 *       properties:
 *         message: { type: string }
 *
 *     MarkReadInput:
 *       type: object
 *       required: [userId, upToMessageId]
 *       properties:
 *         userId: { type: integer }
 *         upToMessageId: { type: integer }
 *
 *     MarkDeliveredInput:
 *       type: object
 *       required: [messageIds]
 *       properties:
 *         messageIds:
 *           type: array
 *           items: { type: integer }
 *           description: "Message ids to mark as delivered to the requesting user"
 *
 *     Error:
 *       type: object
 *       properties:
 *         error: { type: string }
 */

/**
 * @swagger
 * tags:
 *   name: ChatMessages
 *   description: Chat message management API
 */

/**
 * @swagger
 * /api/chatMessages:
 *   post:
 *     summary: Create a new chat message (text or media)
 *     tags: [ChatMessages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MessageInput' }
 *     responses:
 *       201: { description: Message created successfully }
 *       400: { description: Bad request }
 *       403: { description: Blocked or not a room member }
 *       404: { description: Room not found }
 *       500: { description: Server error }
 */
router.post('/', chatMessageController.createMessage);

/**
 * @swagger
 * /api/chatMessages:
 *   get:
 *     summary: Get messages (offset pagination), optionally filtered by room
 *     tags: [ChatMessages]
 *     parameters:
 *       - in: query
 *         name: roomId
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of messages }
 *       500: { description: Server error }
 */
router.get('/', chatMessageController.getMessages);

/**
 * @swagger
 * /api/chatMessages/room/{roomId}/cursor:
 *   get:
 *     summary: Get messages via cursor pagination (for infinite scroll)
 *     tags: [ChatMessages]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: cursor
 *         schema: { type: integer }
 *         description: Last message id seen by the client
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200: { description: Page of messages, oldest-first, plus nextCursor }
 *       500: { description: Server error }
 */
router.get('/room/:roomId/cursor', chatMessageController.getMessagesByCursor);

/**
 * @swagger
 * /api/chatMessages/room/{roomId}/search:
 *   get:
 *     summary: Search messages within a room
 *     tags: [ChatMessages]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Matching messages }
 *       400: { description: Missing query }
 *       500: { description: Server error }
 */
router.get('/room/:roomId/search', chatMessageController.searchMessages);

/**
 * @swagger
 * /api/chatMessages/room/{roomId}/read:
 *   patch:
 *     summary: Mark messages as read up to a given message id
 *     tags: [ChatMessages]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MarkReadInput' }
 *     responses:
 *       200: { description: Number of messages marked read }
 *       400: { description: Missing fields }
 *       500: { description: Server error }
 */
router.patch('/room/:roomId/read', chatMessageController.markRead);

/**
 * @swagger
 * /api/chatMessages/room/{roomId}/delivered:
 *   patch:
 *     summary: Mark messages as delivered (recipient's device received them, not necessarily read yet)
 *     tags: [ChatMessages]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MarkDeliveredInput' }
 *     responses:
 *       200: { description: Number of messages marked delivered }
 *       400: { description: Missing fields }
 *       500: { description: Server error }
 */
router.patch('/room/:roomId/delivered', chatMessageController.markDelivered);

/**
 * @swagger
 * /api/chatMessages/{id}:
 *   get:
 *     summary: Get a specific message by ID
 *     tags: [ChatMessages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Message retrieved successfully }
 *       404: { description: Message not found }
 *       500: { description: Server error }
 */
router.get('/:id', chatMessageController.getMessageById);

/**
 * @swagger
 * /api/chatMessages/{id}:
 *   put:
 *     summary: Update a text message
 *     tags: [ChatMessages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MessageUpdate' }
 *     responses:
 *       200: { description: Message updated successfully }
 *       400: { description: Bad request or not a text message }
 *       500: { description: Server error }
 */
router.put('/:id', chatMessageController.updateMessage);

/**
 * @swagger
 * /api/chatMessages/{id}:
 *   delete:
 *     summary: Soft-delete a message
 *     tags: [ChatMessages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Message deleted successfully }
 *       500: { description: Server error }
 */
router.delete('/:id', chatMessageController.deleteMessage);

export default router;