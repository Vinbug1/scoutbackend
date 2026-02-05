import express from 'express';
const router = express.Router();
import chatRoomController from '../controllers/chatRoomController.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     ChatRoom:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the chat room
 *         name:
 *           type: string
 *           nullable: true
 *           description: The name of the chat room
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the chat room was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the chat room was last updated
 *         messages:
 *           type: array
 *           items:
 *             type: object
 *           description: Messages in the chat room
 *       example:
 *         id: 1
 *         name: "General Discussion"
 *         createdAt: "2024-01-01T00:00:00.000Z"
 *         updatedAt: "2024-01-01T00:00:00.000Z"
 *         messages: []
 *     
 *     ChatRoomInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the chat room
 *       example:
 *         name: "General Discussion"
 *     
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *       example:
 *         error: "Failed to create chat room"
 */

/**
 * @swagger
 * tags:
 *   name: ChatRooms
 *   description: Chat room management API
 */

/**
 * @swagger
 * /api/chatRooms:
 *   post:
 *     summary: Create a new chat room
 *     tags: [ChatRooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRoomInput'
 *     responses:
 *       201:
 *         description: Chat room created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatRoom'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', chatRoomController.create);

/**
 * @swagger
 * /api/chatRooms:
 *   get:
 *     summary: Get all chat rooms
 *     tags: [ChatRooms]
 *     responses:
 *       200:
 *         description: List of all chat rooms
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ChatRoom'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', chatRoomController.getAll);

/**
 * @swagger
 * /api/chatRooms/{id}:
 *   get:
 *     summary: Get a chat room by ID
 *     tags: [ChatRooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The chat room ID
 *     responses:
 *       200:
 *         description: Chat room details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatRoom'
 *       404:
 *         description: Chat room not found
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
router.get('/:id', chatRoomController.getById);

/**
 * @swagger
 * /api/chatRooms/{id}:
 *   put:
 *     summary: Update a chat room
 *     tags: [ChatRooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The chat room ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRoomInput'
 *     responses:
 *       200:
 *         description: Chat room updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatRoom'
 *       404:
 *         description: Chat room not found
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
router.put('/:id', chatRoomController.update);

/**
 * @swagger
 * /api/chatRooms/{id}:
 *   delete:
 *     summary: Delete a chat room
 *     tags: [ChatRooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The chat room ID
 *     responses:
 *       200:
 *         description: Chat room deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *               example:
 *                 message: "Chat room deleted successfully"
 *       404:
 *         description: Chat room not found
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
router.delete('/:id', chatRoomController.delete);

export default router;