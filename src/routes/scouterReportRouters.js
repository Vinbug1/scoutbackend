import express from 'express';
const router = express.Router();
import scouterReportController from '../controllers/scouterReportController.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     ScouterReport:
 *       type: object
 *       required:
 *         - scouterId
 *         - playerId
 *         - title
 *         - report
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated report ID
 *         scouterId:
 *           type: integer
 *           description: ID of the scouter who created the report
 *         playerId:
 *           type: integer
 *           description: ID of the player being scouted
 *         title:
 *           type: string
 *           description: Title of the scouting report
 *         report:
 *           type: string
 *           description: Detailed scouting report content
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when report was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when report was last updated
 *       example:
 *         id: 1
 *         scouterId: 5
 *         playerId: 10
 *         title: "Midfield Performance Analysis"
 *         report: "Excellent ball control and vision. Shows great potential in attacking plays."
 *         createdAt: "2024-01-15T10:30:00Z"
 *         updatedAt: "2024-01-15T10:30:00Z"
 *     
 *     ScouterReportInput:
 *       type: object
 *       required:
 *         - scouterId
 *         - playerId
 *         - title
 *         - report
 *       properties:
 *         scouterId:
 *           type: integer
 *           description: ID of the scouter
 *         playerId:
 *           type: integer
 *           description: ID of the player
 *         title:
 *           type: string
 *           description: Report title
 *         report:
 *           type: string
 *           description: Report content
 *       example:
 *         scouterId: 5
 *         playerId: 10
 *         title: "Midfield Performance Analysis"
 *         report: "Excellent ball control and vision."
 *     
 *     ScouterReportUpdate:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           description: Updated report title
 *         report:
 *           type: string
 *           description: Updated report content
 *       example:
 *         title: "Updated Midfield Analysis"
 *         report: "Shows consistent improvement in passing accuracy."
 *     
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *       example:
 *         error: "Failed to create report"
 */

/**
 * @swagger
 * tags:
 *   name: Scouter Reports
 *   description: Scouter report management API
 */

/**
 * @swagger
 * /api/scouterReports:
 *   post:
 *     summary: Create a new scouter report
 *     tags: [Scouter Reports]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScouterReportInput'
 *     responses:
 *       201:
 *         description: Report created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScouterReport'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', scouterReportController.create);

/**
 * @swagger
 * /api/scouterReports:
 *   get:
 *     summary: Get all scouter reports
 *     tags: [Scouter Reports]
 *     description: Retrieves all scouter reports with scouter and player details
 *     responses:
 *       200:
 *         description: List of all scouter reports
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ScouterReport'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', scouterReportController.getAll);

/**
 * @swagger
 * /api/scouterReports/{id}:
 *   get:
 *     summary: Get a scouter report by ID
 *     tags: [Scouter Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The report ID
 *     responses:
 *       200:
 *         description: Scouter report details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScouterReport'
 *       404:
 *         description: Report not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Report not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', scouterReportController.getById);

/**
 * @swagger
 * /api/scouterReports/{id}:
 *   put:
 *     summary: Update a scouter report
 *     tags: [Scouter Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The report ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScouterReportUpdate'
 *     responses:
 *       200:
 *         description: Report updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScouterReport'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', scouterReportController.update);

/**
 * @swagger
 * /api/scouterReports/{id}:
 *   delete:
 *     summary: Delete a scouter report
 *     tags: [Scouter Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The report ID
 *     responses:
 *       200:
 *         description: Report deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             example:
 *               message: "Report deleted successfully"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', scouterReportController.delete);

export default router;