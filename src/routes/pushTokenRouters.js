import express from 'express';
import pushTokenController from '../controllers/pushTokenController.js';
import { verifyToken as authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * /pushTokens:
 *   post:
 *     summary: Save the current user's push notification device token
 *     tags: [PushTokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Token saved successfully
 *       400:
 *         description: Missing token
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post('/', authenticate, pushTokenController.saveToken);

/**
 * @swagger
 * /pushTokens:
 *   delete:
 *     summary: Remove the current user's push notification device token
 *     tags: [PushTokens]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token removed successfully
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.delete('/', authenticate, pushTokenController.deleteToken);

export default router;