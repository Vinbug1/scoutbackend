import express from 'express';
const router = express.Router();
import playerReportController from '../controllers/playerReportController.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     PlayerReport:
 *       type: object
 *       required:
 *         - playerId
 *         - data
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the player report
 *         playerId:
 *           type: integer
 *           description: The ID of the player
 *         data:
 *           type: object
 *           description: Report data in JSON format
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the report was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the report was last updated
 *       example:
 *         id: 1
 *         playerId: 5
 *         data: {"performance": "excellent", "goals": 3}
 *         createdAt: 2024-01-15T10:30:00.000Z
 *         updatedAt: 2024-01-15T10:30:00.000Z
 *     
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 */

/**
 * @swagger
 * tags:
 *   name: PlayerReports
 *   description: Player report management API
 */

/**
 * @swagger
 * /api/playerReports:
 *   post:
 *     summary: Create a new player report
 *     tags: [PlayerReports]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - playerId
 *               - data
 *             properties:
 *               playerId:
 *                 type: integer
 *                 description: The ID of the player
 *               data:
 *                 type: object
 *                 description: Report data in JSON format
 *             example:
 *               playerId: 5
 *               data: {"performance": "excellent", "goals": 3}
 *     responses:
 *       201:
 *         description: Player report created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlayerReport'
 *       400:
 *         description: Missing required fields
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
router.post('/', playerReportController.create);

/**
 * @swagger
 * /api/playerReports:
 *   get:
 *     summary: Get all player reports
 *     tags: [PlayerReports]
 *     responses:
 *       200:
 *         description: List of all player reports
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PlayerReport'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', playerReportController.getAll);

/**
 * @swagger
 * /api/playerReports/{id}:
 *   get:
 *     summary: Get a player report by ID
 *     tags: [PlayerReports]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The player report ID
 *     responses:
 *       200:
 *         description: Player report details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlayerReport'
 *       404:
 *         description: Player report not found
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
router.get('/:id', playerReportController.getById);

/**
 * @swagger
 * /api/playerReports/{id}:
 *   put:
 *     summary: Update a player report by ID
 *     tags: [PlayerReports]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The player report ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: object
 *                 description: Updated report data in JSON format
 *             example:
 *               data: {"performance": "good", "goals": 2, "assists": 1}
 *     responses:
 *       200:
 *         description: Player report updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlayerReport'
 *       404:
 *         description: Player report not found
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
router.put('/:id', playerReportController.update);

/**
 * @swagger
 * /api/playerReports/{id}:
 *   delete:
 *     summary: Delete a player report by ID
 *     tags: [PlayerReports]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The player report ID
 *     responses:
 *       200:
 *         description: Player report deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Player report deleted successfully
 *       404:
 *         description: Player report not found
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
router.delete('/:id', playerReportController.delete);

export default router;