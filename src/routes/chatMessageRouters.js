import express from 'express';
const router = express.Router();
import chatMessageController from '../controllers/chatMessageController.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     ChatMessage:
 *       type: object
 *       required:
 *         - roomId
 *         - userId
 *         - message
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated message ID
 *         roomId:
 *           type: integer
 *           description: ID of the chat room
 *         userId:
 *           type: integer
 *           description: ID of the user who sent the message
 *         message:
 *           type: string
 *           description: The message content
 *         sentAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when message was sent
 *         user:
 *           type: object
 *           description: User object who sent the message
 *         room:
 *           type: object
 *           description: Room object where message was sent
 *       example:
 *         id: 1
 *         roomId: 5
 *         userId: 10
 *         message: "Hello, everyone!"
 *         sentAt: "2025-11-28T10:30:00.000Z"
 *     
 *     MessageInput:
 *       type: object
 *       required:
 *         - roomId
 *         - userId
 *         - message
 *       properties:
 *         roomId:
 *           type: integer
 *           description: ID of the chat room
 *         userId:
 *           type: integer
 *           description: ID of the user sending the message
 *         message:
 *           type: string
 *           description: The message content
 *       example:
 *         roomId: 5
 *         userId: 10
 *         message: "Hello, everyone!"
 *     
 *     MessageUpdate:
 *       type: object
 *       required:
 *         - message
 *       properties:
 *         message:
 *           type: string
 *           description: Updated message content
 *       example:
 *         message: "Hello, everyone! (edited)"
 *     
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *       example:
 *         error: "Failed to create message"
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
 *     summary: Create a new chat message
 *     tags: [ChatMessages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MessageInput'
 *     responses:
 *       201:
 *         description: Message created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatMessage'
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', chatMessageController.createMessage);

/**
 * @swagger
 * /api/chatMessages:
 *   get:
 *     summary: Get all chat messages or filter by room
 *     tags: [ChatMessages]
 *     parameters:
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: integer
 *         required: false
 *         description: Optional room ID to filter messages
 *     responses:
 *       200:
 *         description: List of messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ChatMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', chatMessageController.getMessages);

/**
 * @swagger
 * /api/chatMessages/{id}:
 *   get:
 *     summary: Get a specific message by ID
 *     tags: [ChatMessages]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatMessage'
 *       404:
 *         description: Message not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', chatMessageController.getMessageById);

/**
 * @swagger
 * /api/chatMessages/{id}:
 *   put:
 *     summary: Update a message
 *     tags: [ChatMessages]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MessageUpdate'
 *     responses:
 *       200:
 *         description: Message updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatMessage'
 *       400:
 *         description: Bad request - message content required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', chatMessageController.updateMessage);

/**
 * @swagger
 * /api/chatMessages/{id}:
 *   delete:
 *     summary: Delete a message
 *     tags: [ChatMessages]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Message deleted successfully"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', chatMessageController.deleteMessage);

export default router;