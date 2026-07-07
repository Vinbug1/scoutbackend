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
 *         id: { type: integer }
 *         name: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         lastMessageId: { type: integer, nullable: true }
 *
 *     ChatRoomInput:
 *       type: object
 *       properties:
 *         name: { type: string }
 *         userIds: { type: array, items: { type: integer } }
 *
 *     DirectConversationInput:
 *       type: object
 *       required: [userId, otherUserId]
 *       properties:
 *         userId: { type: integer }
 *         otherUserId: { type: integer }
 *
 *     Error:
 *       type: object
 *       properties:
 *         error: { type: string }
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
 *     summary: Create a new chat room (group-style, explicit members)
 *     tags: [ChatRooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChatRoomInput' }
 *     responses:
 *       201: { description: Chat room created successfully }
 *       500: { description: Server error }
 */
router.post('/', chatRoomController.create);

/**
 * @swagger
 * /api/chatRooms/direct:
 *   post:
 *     summary: Find or create a 1:1 conversation between two users
 *     tags: [ChatRooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/DirectConversationInput' }
 *     responses:
 *       200: { description: Existing or newly created room }
 *       400: { description: Bad request }
 *       403: { description: One user has blocked the other }
 *       404: { description: User not found }
 *       500: { description: Server error }
 */
router.post('/direct', chatRoomController.findOrCreateDirect);

/**
 * @swagger
 * /api/chatRooms:
 *   get:
 *     summary: Get all chat rooms (admin/debug — not scoped to a user)
 *     tags: [ChatRooms]
 *     responses:
 *       200: { description: List of all chat rooms }
 *       500: { description: Server error }
 */
router.get('/', chatRoomController.getAll);

/**
 * @swagger
 * /api/chatRooms/user/{userId}:
 *   get:
 *     summary: Get a user's conversation list with unread counts
 *     tags: [ChatRooms]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of conversations for this user }
 *       400: { description: Invalid user id }
 *       500: { description: Server error }
 */
router.get('/user/:userId', chatRoomController.getForUser);

/**
 * @swagger
 * /api/chatRooms/{id}:
 *   get:
 *     summary: Get a chat room by ID
 *     tags: [ChatRooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Chat room details }
 *       404: { description: Chat room not found }
 *       500: { description: Server error }
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
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChatRoomInput' }
 *     responses:
 *       200: { description: Chat room updated successfully }
 *       404: { description: Chat room not found }
 *       500: { description: Server error }
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
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Chat room deleted successfully }
 *       404: { description: Chat room not found }
 *       500: { description: Server error }
 */
router.delete('/:id', chatRoomController.delete);

/**
 * @swagger
 * /api/chatRooms/{id}/members:
 *   post:
 *     summary: Add a member to a room
 *     tags: [ChatRooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: integer }
 *     responses:
 *       201: { description: Member added successfully }
 *       409: { description: User already a member }
 *       500: { description: Server error }
 */
router.post('/:id/members', chatRoomController.addMember);

/**
 * @swagger
 * /api/chatRooms/{id}/members/{userId}:
 *   delete:
 *     summary: Remove a member from a room
 *     tags: [ChatRooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Member removed successfully }
 *       404: { description: Member not found in this room }
 *       500: { description: Server error }
 */
router.delete('/:id/members/:userId', chatRoomController.removeMember);

export default router;










// import express from 'express';
// const router = express.Router();
// import chatRoomController from '../controllers/chatRoomController.js';

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     ChatRoom:
//  *       type: object
//  *       properties:
//  *         id:
//  *           type: integer
//  *           description: The auto-generated id of the chat room
//  *         name:
//  *           type: string
//  *           nullable: true
//  *           description: The name of the chat room
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           description: The date the chat room was created
//  *         updatedAt:
//  *           type: string
//  *           format: date-time
//  *           description: The date the chat room was last updated
//  *         messages:
//  *           type: array
//  *           items:
//  *             type: object
//  *           description: Messages in the chat room
//  *       example:
//  *         id: 1
//  *         name: "General Discussion"
//  *         createdAt: "2024-01-01T00:00:00.000Z"
//  *         updatedAt: "2024-01-01T00:00:00.000Z"
//  *         messages: []
//  *     
//  *     ChatRoomInput:
//  *       type: object
//  *       properties:
//  *         name:
//  *           type: string
//  *           description: The name of the chat room
//  *       example:
//  *         name: "General Discussion"
//  *     
//  *     Error:
//  *       type: object
//  *       properties:
//  *         error:
//  *           type: string
//  *           description: Error message
//  *       example:
//  *         error: "Failed to create chat room"
//  */

// /**
//  * @swagger
//  * tags:
//  *   name: ChatRooms
//  *   description: Chat room management API
//  */

// /**
//  * @swagger
//  * /api/chatRooms:
//  *   post:
//  *     summary: Create a new chat room
//  *     tags: [ChatRooms]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/ChatRoomInput'
//  *     responses:
//  *       201:
//  *         description: Chat room created successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ChatRoom'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.post('/', chatRoomController.create);

// /**
//  * @swagger
//  * /api/chatRooms:
//  *   get:
//  *     summary: Get all chat rooms
//  *     tags: [ChatRooms]
//  *     responses:
//  *       200:
//  *         description: List of all chat rooms
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items:
//  *                 $ref: '#/components/schemas/ChatRoom'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/', chatRoomController.getAll);

// /**
//  * @swagger
//  * /api/chatRooms/{id}:
//  *   get:
//  *     summary: Get a chat room by ID
//  *     tags: [ChatRooms]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         schema:
//  *           type: integer
//  *         required: true
//  *         description: The chat room ID
//  *     responses:
//  *       200:
//  *         description: Chat room details
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ChatRoom'
//  *       404:
//  *         description: Chat room not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/:id', chatRoomController.getById);

// /**
//  * @swagger
//  * /api/chatRooms/{id}:
//  *   put:
//  *     summary: Update a chat room
//  *     tags: [ChatRooms]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         schema:
//  *           type: integer
//  *         required: true
//  *         description: The chat room ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/ChatRoomInput'
//  *     responses:
//  *       200:
//  *         description: Chat room updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ChatRoom'
//  *       404:
//  *         description: Chat room not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.put('/:id', chatRoomController.update);

// /**
//  * @swagger
//  * /api/chatRooms/{id}:
//  *   delete:
//  *     summary: Delete a chat room
//  *     tags: [ChatRooms]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         schema:
//  *           type: integer
//  *         required: true
//  *         description: The chat room ID
//  *     responses:
//  *       200:
//  *         description: Chat room deleted successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *               example:
//  *                 message: "Chat room deleted successfully"
//  *       404:
//  *         description: Chat room not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.delete('/:id', chatRoomController.delete);

// export default router;