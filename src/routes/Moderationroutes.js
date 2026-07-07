import express from 'express';
const router = express.Router();
import moderationController from '../controllers/Moderationcontroller';

/**
 * @swagger
 * components:
 *   schemas:
 *     BlockInput:
 *       type: object
 *       required: [blockerId, blockedId]
 *       properties:
 *         blockerId: { type: integer }
 *         blockedId: { type: integer }
 *
 *     ReportInput:
 *       type: object
 *       required: [reporterId, reportedId, reason]
 *       properties:
 *         reporterId: { type: integer }
 *         reportedId: { type: integer }
 *         reason: { type: string }
 *         messageId: { type: integer, description: "Optional - the specific message being reported" }
 */

/**
 * @swagger
 * tags:
 *   name: Moderation
 *   description: Block and report API
 */

/**
 * @swagger
 * /api/moderation/block:
 *   post:
 *     summary: Block a user
 *     tags: [Moderation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BlockInput' }
 *     responses:
 *       201: { description: User blocked successfully }
 *       400: { description: Bad request }
 *       404: { description: User not found }
 *       500: { description: Server error }
 */
router.post('/block', moderationController.blockUser);

/**
 * @swagger
 * /api/moderation/block:
 *   delete:
 *     summary: Unblock a user
 *     tags: [Moderation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BlockInput' }
 *     responses:
 *       200: { description: User unblocked successfully }
 *       500: { description: Server error }
 */
router.delete('/block', moderationController.unblockUser);

/**
 * @swagger
 * /api/moderation/block/{userId}:
 *   get:
 *     summary: List users blocked by this user
 *     tags: [Moderation]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of blocked users }
 *       500: { description: Server error }
 */
router.get('/block/:userId', moderationController.listBlocked);

/**
 * @swagger
 * /api/moderation/report:
 *   post:
 *     summary: Report a user or message
 *     tags: [Moderation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ReportInput' }
 *     responses:
 *       201: { description: Report submitted successfully }
 *       400: { description: Bad request }
 *       404: { description: User not found }
 *       500: { description: Server error }
 */
router.post('/report', moderationController.reportUser);

export default router;