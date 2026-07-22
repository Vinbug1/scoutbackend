import express from 'express';
import chatRoomController from '../controllers/chatRoomController.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *
 *   schemas:
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: Chat room not found
 *
 *     ChatRoom:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 12
 *
 *         type:
 *           type: string
 *           enum:
 *             - DIRECT
 *             - GROUP
 *
 *         name:
 *           type: string
 *           nullable: true
 *           example: Family Group
 *
 *         creatorId:
 *           type: integer
 *           nullable: true
 *           example: 5
 *
 *         seqCounter:
 *           type: integer
 *           example: 145
 *
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     ChatParticipant:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 10
 *
 *         fullname:
 *           type: string
 *           example: John Doe
 *
 *         email:
 *           type: string
 *           example: john@example.com
 *
 *         isOnline:
 *           type: boolean
 *           example: true
 *
 *         lastSeenAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     LastMessage:
 *       type: object
 *       nullable: true
 *       properties:
 *         preview:
 *           type: string
 *           example: Hello everyone
 *
 *         senderId:
 *           type: integer
 *           example: 7
 *
 *         seq:
 *           type: integer
 *           example: 52
 *
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     Conversation:
 *       type: object
 *       properties:
 *         roomId:
 *           type: integer
 *           example: 12
 *
 *         name:
 *           type: string
 *           nullable: true
 *
 *         participants:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChatParticipant'
 *
 *         lastMessage:
 *           $ref: '#/components/schemas/LastMessage'
 *
 *         unreadCount:
 *           type: integer
 *           example: 4
 *
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     ChatRoomInput:
 *       type: object
 *       required:
 *         - userIds
 *       properties:
 *         name:
 *           type: string
 *           example: Family Group
 *
 *         userIds:
 *           type: array
 *           items:
 *             type: integer
 *           example:
 *             - 2
 *             - 5
 *             - 8
 *
 *     DirectConversationInput:
 *       type: object
 *       required:
 *         - otherUserId
 *       properties:
 *         otherUserId:
 *           type: integer
 *           example: 27
 *
 *     AddMemberInput:
 *       type: object
 *       required:
 *         - userId
 *       properties:
 *         userId:
 *           type: integer
 *           example: 18
 *
 *         role:
 *           type: string
 *           enum:
 *             - ADMIN
 *             - MEMBER
 *           default: MEMBER
 *
 *     UpdateMemberRoleInput:
 *       type: object
 *       required:
 *         - role
 *       properties:
 *         role:
 *           type: string
 *           enum:
 *             - ADMIN
 *             - MEMBER
 *
 *     MuteRoomInput:
 *       type: object
 *       properties:
 *         mutedUntil:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     ConversationListResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Conversation'
 *
 *         nextCursor:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     ChatRoomListResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChatRoom'
 *
 *         meta:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *
 *             page:
 *               type: integer
 *
 *             limit:
 *               type: integer
 *
 *             totalPages:
 *               type: integer
 */

/**
 * @swagger
 * tags:
 *   - name: Chat Rooms
 *     description: Chat room and conversation management endpoints
 */

/**
 * @swagger
 * /api/chatRooms:
 *   post:
 *     summary: Create a new group chat
 *     description: |
 *       Creates a new GROUP conversation.
 *       The authenticated user automatically becomes the group's creator
 *       and is assigned the ADMIN role.
 *
 *     tags:
 *       - Chat Rooms
 *
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRoomInput'
 *
 *     responses:
 *       201:
 *         description: Group created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Chat room created successfully
 *
 *                 data:
 *                   $ref: '#/components/schemas/ChatRoom'
 *
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       401:
 *         description: Authentication required
 *
 *       500:
 *         description: Internal server error
 */
router.post('/', chatRoomController.create);


/**
 * @swagger
 * /chatRooms/direct:
 *   post:
 *     summary: Find or create a direct conversation
 *
 *     description: |
 *       Finds an existing DIRECT conversation between the authenticated
 *       user and another user.
 *
 *       If none exists, a new direct conversation is created.
 *
 *       The authenticated user's id is obtained from the JWT.
 *
 *     tags:
 *       - Chat Rooms
 *
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DirectConversationInput'
 *
 *     responses:
 *       200:
 *         description: Existing or newly created conversation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ChatRoom'
 *
 *       400:
 *         description: |
 *           Invalid request.
 *           This includes attempting to create a conversation with yourself.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       401:
 *         description: Authentication required
 *
 *       403:
 *         description: One of the users has blocked the other
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       404:
 *         description: Target user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       500:
 *         description: Internal server error
 */
router.post('/direct', chatRoomController.findOrCreateDirect);

/**
 * @swagger
 * /api/chatRooms:
 *   get:
 *     summary: Get all chat rooms (Admin only)
 *     description: |
 *       Returns every chat room in the system.
 *
 *       This endpoint is intended for administrative or debugging purposes
 *       and is **not** the endpoint used by chat clients to retrieve
 *       conversations.
 *
 *     tags:
 *       - Chat Rooms
 *
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *
 *     responses:
 *       200:
 *         description: List of chat rooms
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatRoomListResponse'
 *
 *       401:
 *         description: Authentication required
 *
 *       403:
 *         description: Administrator access required
 *
 *       500:
 *         description: Internal server error
 */
router.get('/', chatRoomController.getAll);

/**
 * @swagger
 * /api/chatRooms/me:
 *   get:
 *     summary: Get my conversations
 *
 *     description: |
 *       Returns the authenticated user's conversation list.
 *
 *       Results are cursor paginated using the ChatLastMessage cache.
 *
 *       Use the nextCursor returned by the previous request as the
 *       value of the before query parameter.
 *
 *     tags:
 *       - Chat Rooms
 *
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *
 *       - in: query
 *         name: before
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 30
 *
 *     responses:
 *       200:
 *         description: User conversation list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConversationListResponse'
 *
 *       401:
 *         description: Authentication required
 *
 *       500:
 *         description: Internal server error
 */
router.get('/me', chatRoomController.getForUser);

/**
 * @swagger
 * /api/chatRooms/{id}:
 *   get:
 *     summary: Get chat room details
 *     description: |
 *       Returns the details of a chat room including:
 *
 *       - members
 *       - message history
 *       - message count
 *       - member count
 *
 *       Note:
 *       This endpoint returns the complete message history currently.
 *       Clients displaying the chat screen should instead use the
 *       paginated ChatMessage endpoints.
 *
 *     tags:
 *       - Chat Rooms
 *
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *
 *     responses:
 *       200:
 *         description: Chat room details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ChatRoom'
 *
 *       401:
 *         description: Authentication required
 *
 *       403:
 *         description: User is not permitted to access this room
 *
 *       404:
 *         description: Chat room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       500:
 *         description: Internal server error
 */
router.get('/:id', chatRoomController.getById);

/**
 * @swagger
 * /api/chatRooms/{id}:
 *   put:
 *     summary: Update a group chat
 *     description: |
 *       Updates the name of an existing group chat.
 *
 *       Only authorized users (typically group admins) should be allowed
 *       to perform this operation.
 *
 *     tags:
 *       - Chat Rooms
 *
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 15
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Engineering Team
 *
 *     responses:
 *       200:
 *         description: Chat room updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Chat room updated successfully
 *
 *                 data:
 *                   $ref: '#/components/schemas/ChatRoom'
 *
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       401:
 *         description: Authentication required
 *
 *       403:
 *         description: Permission denied
 *
 *       404:
 *         description: Chat room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       500:
 *         description: Internal server error
 */
router.put('/:id', chatRoomController.update);

/**
 * @swagger
 * /api/chatRooms/{id}:
 *   delete:
 *     summary: Delete a chat room
 *     description: |
 *       Permanently deletes a chat room together with its
 *       messages and related metadata.
 *
 *       This operation should only be performed by authorized users.
 *
 *     tags:
 *       - Chat Rooms
 *
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 15
 *
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
 *                   example: Chat room deleted successfully
 *
 *       401:
 *         description: Authentication required
 *
 *       403:
 *         description: Permission denied
 *
 *       404:
 *         description: Chat room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', chatRoomController.delete);

/**
 * @swagger
 * /api/chatRooms/{id}/members:
 *   post:
 *     summary: Add a member to a group
 *     description: |
 *       Adds a new member to a group conversation.
 *
 *       **Authorization**
 *       - JWT required
 *       - Caller must already be a member
 *       - Caller must have ADMIN role
 *       - Cannot be used on DIRECT conversations
 *     tags: [ChatRooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Group room ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 25
 *               role:
 *                 type: string
 *                 enum:
 *                   - MEMBER
 *                   - ADMIN
 *                 default: MEMBER
 *     responses:
 *       201:
 *         description: Member added successfully
 *       400:
 *         description: Invalid request or room is not a group
 *       403:
 *         description: Only admins can add members
 *       404:
 *         description: Room or user not found
 *       409:
 *         description: User is already a member
 *       500:
 *         description: Internal server error
 */
router.post('/:id/members',chatRoomController.addMember );

/**
 * @swagger
 * /api/chatRooms/{id}/members/{userId}:
 *   delete:
 *     summary: Remove a member from a group
 *     description: |
 *       Removes a member from a group.
 *
 *       Rules:
 *       - Admins can remove any member.
 *       - Members may remove themselves (leave group).
 *       - The last remaining admin cannot leave until another admin exists.
 *       - Cannot be used on DIRECT conversations.
 *     tags: [ChatRooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: userId
 *         required: true
 *         description: User to remove
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       400:
 *         description: Invalid request or last admin cannot leave
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Room or member not found
 *       500:
 *         description: Internal server error
 */
router.delete( '/:id/members/:userId',chatRoomController.removeMember );

/**
 * @swagger
 * /api/chatRooms/{id}/members/{userId}/role:
 *   patch:
 *     summary: Change a member's role
 *     description: |
 *       Promote or demote a member.
 *
 *       Only group admins may change roles.
 *     tags: [ChatRooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum:
 *                   - ADMIN
 *                   - MEMBER
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Only admins can change roles
 *       404:
 *         description: Room or member not found
 *       500:
 *         description: Internal server error
 */
router.patch('/:id/members/:userId/role',chatRoomController.updateMemberRole );

/**
 * @swagger
 * /api/chatRooms/{id}/mute:
 *   patch:
 *     summary: Mute a conversation
 *     description: |
 *       Mutes notifications for the authenticated user's membership
 *       in the specified conversation.
 *     tags: [ChatRooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mutedUntil:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2026-07-20T12:00:00Z"
 *     responses:
 *       200:
 *         description: Conversation muted
 *       403:
 *         description: User is not a member of the room
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.patch( '/:id/mute',chatRoomController.muteRoom);

/**
 * @swagger
 * /api/chatRooms/{id}/unmute:
 *   patch:
 *     summary: Unmute a conversation
 *     description: |
 *       Removes the mute setting for the authenticated user.
 *     tags: [ChatRooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Conversation unmuted
 *       403:
 *         description: User is not a member of the room
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.patch( '/:id/unmute', chatRoomController.unmuteRoom );

export default router;

