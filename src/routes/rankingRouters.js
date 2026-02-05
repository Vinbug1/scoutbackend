import express from 'express';
const router = express.Router();
import rankingController from '../controllers/rankingController.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Ranking:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the ranking
 *         userId:
 *           type: integer
 *           description: The ID of the user
 *         score:
 *           type: number
 *           description: The ranking score
 *         reason:
 *           type: string
 *           description: Reason for the ranking
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the ranking was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the ranking was last updated
 *         user:
 *           type: object
 *           description: User details (included in some responses)
 *       example:
 *         id: 1
 *         userId: 5
 *         score: 95.5
 *         reason: "Excellent performance"
 *         createdAt: "2024-01-01T00:00:00.000Z"
 *         updatedAt: "2024-01-01T00:00:00.000Z"
 *     RankingInput:
 *       type: object
 *       required:
 *         - userId
 *       properties:
 *         userId:
 *           type: integer
 *           description: The ID of the user
 *         score:
 *           type: number
 *           description: The ranking score (defaults to 0)
 *         reason:
 *           type: string
 *           description: Reason for the ranking
 *       example:
 *         userId: 5
 *         score: 95.5
 *         reason: "Excellent performance"
 *     Error:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Error message
 *       example:
 *         message: "Failed to fetch rankings."
 */

/**
 * @swagger
 * tags:
 *   name: Rankings
 *   description: Ranking management API
 */

/**
 * @swagger
 * /api/rankings:
 *   post:
 *     summary: Create a new ranking
 *     tags: [Rankings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RankingInput'
 *     responses:
 *       201:
 *         description: Ranking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ranking'
 *       400:
 *         description: Ranking for this user already exists
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
router.post('/', rankingController.createRanking);

/**
 * @swagger
 * /api/rankings:
 *   get:
 *     summary: Get all rankings
 *     tags: [Rankings]
 *     description: Retrieve all rankings ordered by score (descending) with user details
 *     responses:
 *       200:
 *         description: List of all rankings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Ranking'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', rankingController.getRankings);

/**
 * @swagger
 * /api/rankings/{id}:
 *   get:
 *     summary: Get a ranking by ID
 *     tags: [Rankings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ranking ID
 *     responses:
 *       200:
 *         description: Ranking details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ranking'
 *       404:
 *         description: Ranking not found
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
router.get('/:id', rankingController.getRankingById);

/**
 * @swagger
 * /api/rankings/{id}:
 *   put:
 *     summary: Update a ranking
 *     tags: [Rankings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ranking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               score:
 *                 type: number
 *                 description: The ranking score
 *               reason:
 *                 type: string
 *                 description: Reason for the ranking
 *             example:
 *               score: 98.0
 *               reason: "Updated performance review"
 *     responses:
 *       200:
 *         description: Ranking updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ranking'
 *       404:
 *         description: Ranking not found
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
router.put('/:id', rankingController.updateRanking);

/**
 * @swagger
 * /api/rankings/{id}:
 *   delete:
 *     summary: Delete a ranking
 *     tags: [Rankings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ranking ID
 *     responses:
 *       200:
 *         description: Ranking deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *               example:
 *                 message: "Ranking deleted successfully."
 *       404:
 *         description: Ranking not found
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
router.delete('/:id', rankingController.deleteRanking);

export default router;