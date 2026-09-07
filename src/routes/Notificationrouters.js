import express from 'express';
import notificationController from '../controllers/Notificationcontroller';
import { verifyToken as authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: The in-app notifications inbox (follow-feature plan §7)
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
 *       500:
 *         description: Server error
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
 *       500:
 *         description: Server error
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
 *       400:
 *         description: Invalid notification id
 *       500:
 *         description: Server error
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
 *       500:
 *         description: Server error
 */
router.post('/read-all', authenticate, notificationController.markAllRead);

export default router;