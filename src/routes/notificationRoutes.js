import express from 'express';
import notificationController from '../controllers/notificationController.js';
import { verifyToken as authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: The in-app notifications inbox (follow-feature plan §7)
 *
 * components:
 *   schemas:
 *     NotificationActor:
 *       type: object
 *       nullable: true
 *       description: Who triggered this notification. Null for system-generated notifications with no actor.
 *       properties:
 *         id:        { type: integer }
 *         fullname:  { type: string }
 *         role:      { type: string, enum: [PLAYER, SCOUT, ADMIN] }
 *         avatarUrl: { type: string, nullable: true, format: uri }
 *       example:
 *         id: 42
 *         fullname: Marcus Adeyemi
 *         role: PLAYER
 *         avatarUrl: https://cdn.thescouterpro.com/avatars/42.jpg
 *
 *     NotificationData:
 *       type: object
 *       description: >
 *         The exact same payload sent as the push (plan §6's "push and
 *         inbox are the same event" rule) — a tap routes from this alone,
 *         no follow-up request. Fields present depend on `type`; see
 *         pushNotificationService.js's buildNotificationData for which
 *         fields each type requires.
 *       properties:
 *         type:           { type: string, enum: [FOLLOW, POST, NOTIFICATION, CHAT, GENERIC] }
 *         role:           { type: string, enum: [PLAYER, SCOUT, ADMIN], description: Recipient's role at send time }
 *         recipientId:    { type: string }
 *         actorUserId:    { type: string, description: Present on FOLLOW and POST — who to open the profile/reel for }
 *         title:          { type: string }
 *         body:           { type: string }
 *         reelId:         { type: string, description: POST only }
 *         playerId:       { type: string, description: POST only — see plan §9 blocker 1 }
 *         reelIndex:      { type: string, description: POST only — this reel's position in the player's published reels }
 *         roomId:         { type: string, description: CHAT only }
 *         peerUserId:     { type: string, description: CHAT only }
 *         notificationId: { type: string, description: This notification's own id, as a string }
 *       example:
 *         type: POST
 *         role: SCOUT
 *         recipientId: "17"
 *         actorUserId: "42"
 *         title: Marcus Adeyemi posted a new reel
 *         body: "Dribbling · 0:42"
 *         reelId: "9931"
 *         playerId: "42"
 *         reelIndex: "0"
 *         notificationId: "88214"
 *
 *     NotificationItem:
 *       type: object
 *       properties:
 *         id:        { type: integer }
 *         read:      { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *         actor:     { $ref: '#/components/schemas/NotificationActor' }
 *         data:      { $ref: '#/components/schemas/NotificationData' }
 *
 *     NotificationListResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         data:
 *           type: array
 *           items: { $ref: '#/components/schemas/NotificationItem' }
 *         pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *
 *     UnreadCountResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         data:
 *           type: object
 *           properties:
 *             count: { type: integer, example: 3 }
 *
 *     NotificationSuccessResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *
 *     NotificationErrorResponse:
 *       type: object
 *       properties:
 *         error: { type: string }
 *       example:
 *         error: Invalid notification id
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: List notifications, newest first
 *     description: >
 *       Each row embeds the actor (avatar + name) and a `data` object —
 *       the exact same payload sent as the push — so a tap can navigate
 *       without a follow-up request.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200:
 *         description: Paginated notification list
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/NotificationListResponse' }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/NotificationErrorResponse' }
 */
router.get('/', authenticate, notificationController.list);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Get the unread notification count
 *     description: Separate endpoint so polling for the tab badge doesn't pull the whole list.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UnreadCountResponse' }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/NotificationErrorResponse' }
 */
router.get('/unread-count', authenticate, notificationController.unreadCount);

/**
 * @swagger
 * /notifications/{id}/read:
 *   post:
 *     summary: Mark a single notification as read
 *     description: Safe to call more than once.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Marked read
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/NotificationSuccessResponse' }
 *       400:
 *         description: Invalid notification id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/NotificationErrorResponse' }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/NotificationErrorResponse' }
 */
router.post('/:id/read', authenticate, notificationController.markRead);

/**
 * @swagger
 * /notifications/read-all:
 *   post:
 *     summary: Mark every notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All marked read
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/NotificationSuccessResponse' }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/NotificationErrorResponse' }
 */
router.post('/read-all', authenticate, notificationController.markAllRead);

export default router;












// import express from 'express';
// import notificationController from '../controllers/notificationController.js';
// import { verifyToken as authenticate } from '../middleware/auth.js';

// const router = express.Router();

// /**
//  * @swagger
//  * tags:
//  *   - name: Notifications
//  *     description: The in-app notifications inbox (follow-feature plan §7)
//  */

// /**
//  * @swagger
//  * /notifications:
//  *   get:
//  *     summary: List notifications, newest first
//  *     description: >
//  *       Each row embeds the actor (avatar + name) and a `data` object —
//  *       the exact same payload sent as the push — so a tap can navigate
//  *       without a follow-up request.
//  *     tags: [Notifications]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: page
//  *         schema: { type: integer, default: 1 }
//  *       - in: query
//  *         name: limit
//  *         schema: { type: integer, default: 20, maximum: 50 }
//  *     responses:
//  *       200:
//  *         description: Paginated notification list
//  *       500:
//  *         description: Server error
//  */
// router.get('/', authenticate, notificationController.list);

// /**
//  * @swagger
//  * /notifications/unread-count:
//  *   get:
//  *     summary: Get the unread notification count
//  *     description: Separate endpoint so polling for the tab badge doesn't pull the whole list.
//  *     tags: [Notifications]
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200:
//  *         description: Unread count
//  *       500:
//  *         description: Server error
//  */
// router.get('/unread-count', authenticate, notificationController.unreadCount);

// /**
//  * @swagger
//  * /notifications/{id}/read:
//  *   post:
//  *     summary: Mark a single notification as read
//  *     description: Safe to call more than once.
//  *     tags: [Notifications]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema: { type: integer }
//  *     responses:
//  *       200:
//  *         description: Marked read
//  *       400:
//  *         description: Invalid notification id
//  *       500:
//  *         description: Server error
//  */
// router.post('/:id/read', authenticate, notificationController.markRead);

// /**
//  * @swagger
//  * /notifications/read-all:
//  *   post:
//  *     summary: Mark every notification as read
//  *     tags: [Notifications]
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200:
//  *         description: All marked read
//  *       500:
//  *         description: Server error
//  */
// router.post('/read-all', authenticate, notificationController.markAllRead);

// export default router;