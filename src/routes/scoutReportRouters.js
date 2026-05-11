import express from 'express';
import scoutReportController from '../controllers/scoutReportController.js';
import { verifyToken as authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *
 *     AttributeScores:
 *       type: object
 *       description: All graded attributes (1–10 each)
 *       properties:
 *         firstTouch:              { type: integer, minimum: 1, maximum: 10 }
 *         ballControl:             { type: integer, minimum: 1, maximum: 10 }
 *         dribbling:               { type: integer, minimum: 1, maximum: 10 }
 *         passingShort:            { type: integer, minimum: 1, maximum: 10 }
 *         passingLong:             { type: integer, minimum: 1, maximum: 10 }
 *         throughBalls:            { type: integer, minimum: 1, maximum: 10 }
 *         smartPass:               { type: integer, minimum: 1, maximum: 10 }
 *         shooting:                { type: integer, minimum: 1, maximum: 10 }
 *         heading:                 { type: integer, minimum: 1, maximum: 10 }
 *         tackling:                { type: integer, minimum: 1, maximum: 10 }
 *         weakerFoot:              { type: integer, minimum: 1, maximum: 10 }
 *         positionalAwareness:     { type: integer, minimum: 1, maximum: 10 }
 *         decisionMaking:          { type: integer, minimum: 1, maximum: 10 }
 *         movementOffBall:         { type: integer, minimum: 1, maximum: 10 }
 *         gameIntelligence:        { type: integer, minimum: 1, maximum: 10 }
 *         transitions:             { type: integer, minimum: 1, maximum: 10 }
 *         pace:                    { type: integer, minimum: 1, maximum: 10 }
 *         agilityBalance:          { type: integer, minimum: 1, maximum: 10 }
 *         strength:                { type: integer, minimum: 1, maximum: 10 }
 *         staminaWorkRate:         { type: integer, minimum: 1, maximum: 10 }
 *         jumpingRate:             { type: integer, minimum: 1, maximum: 10 }
 *         composure:               { type: integer, minimum: 1, maximum: 10 }
 *         braveryCommitment:       { type: integer, minimum: 1, maximum: 10 }
 *         determination:           { type: integer, minimum: 1, maximum: 10 }
 *         leadershipCommunication: { type: integer, minimum: 1, maximum: 10 }
 *         coachability:            { type: integer, minimum: 1, maximum: 10 }
 *
 *     ScoutReportInput:
 *       type: object
 *       required:
 *         - playerId
 *       allOf:
 *         - $ref: '#/components/schemas/AttributeScores'
 *       properties:
 *         playerId:            { type: integer }
 *         matchScouted:        { type: string }
 *         ageGroup:            { type: string }
 *         timesSeen:           { type: integer }
 *         currentClub:         { type: string }
 *         overallAssessment:   { type: string }
 *         keyStrengths:
 *           type: array
 *           items: { type: string }
 *         areasForDevelopment:
 *           type: array
 *           items: { type: string }
 *         recommendation:
 *           type: string
 *           enum: [RECOMMEND_FOR_TRIAL, FILE_FOR_FUTURE_REFERENCE, NOT_SUITABLE]
 *       example:
 *         playerId: 10
 *         matchScouted: "Demo match name"
 *         ageGroup: "19-20 yrs"
 *         timesSeen: 3
 *         currentClub: "Demo FC"
 *         overallAssessment: "Excellent agility and strategic thinking."
 *         firstTouch: 9
 *         ballControl: 8
 *         pace: 9
 *         composure: 8
 *         keyStrengths: ["Great vision", "Strong in duels"]
 *         areasForDevelopment: ["Stamina under pressure"]
 *         recommendation: "RECOMMEND_FOR_TRIAL"
 *
 *     ScoutReportUpdate:
 *       type: object
 *       description: All fields optional — only send what changed.
 *       allOf:
 *         - $ref: '#/components/schemas/AttributeScores'
 *       properties:
 *         matchScouted:        { type: string }
 *         ageGroup:            { type: string }
 *         timesSeen:           { type: integer }
 *         currentClub:         { type: string }
 *         overallAssessment:   { type: string }
 *         keyStrengths:
 *           type: array
 *           items: { type: string }
 *         areasForDevelopment:
 *           type: array
 *           items: { type: string }
 *         recommendation:
 *           type: string
 *           enum: [RECOMMEND_FOR_TRIAL, FILE_FOR_FUTURE_REFERENCE, NOT_SUITABLE]
 *
 *     ScoutReport:
 *       allOf:
 *         - $ref: '#/components/schemas/ScoutReportInput'
 *       properties:
 *         id:        { type: integer }
 *         createdAt: { type: string, format: date-time }
 *         scout:
 *           type: object
 *           properties:
 *             id:       { type: integer }
 *             fullname: { type: string }
 *             email:    { type: string }
 *         player:
 *           type: object
 *           properties:
 *             id:       { type: integer }
 *             fullname: { type: string }
 *             email:    { type: string }
 *             profile:
 *               type: object
 *               properties:
 *                 position: { type: string }
 *                 height:   { type: number }
 *                 dob:      { type: string, format: date-time }
 *                 country:  { type: string }
 *                 city:     { type: string }
 *
 *     Error:
 *       type: object
 *       properties:
 *         error: { type: string }
 *       example:
 *         error: "Failed to create report"
 */

/**
 * @swagger
 * tags:
 *   name: Scout Reports
 *   description: Scouting report management — scouts only
 */

/**
 * @swagger
 * /api/scoutReports:
 *   post:
 *     summary: Create a new scout report
 *     tags: [Scout Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScoutReportInput'
 *     responses:
 *       201: { description: Report created successfully }
 *       400: { description: Missing required fields }
 *       401: { description: Not authenticated }
 *       403: { description: Access denied - scouts only }
 *       404: { description: Player not found }
 *       500: { description: Server error }
 */
// ✅ SCOUT only - create a report
router.post('/', authenticate, authorizeRoles('SCOUT'), scoutReportController.create);

/**
 * @swagger
 * /api/scoutReports:
 *   get:
 *     summary: Get all scout reports
 *     tags: [Scout Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: scoutId
 *         schema: { type: integer }
 *         description: Filter by scout
 *       - in: query
 *         name: playerId
 *         schema: { type: integer }
 *         description: Filter by player
 *       - in: query
 *         name: recommendation
 *         schema:
 *           type: string
 *           enum: [RECOMMEND_FOR_TRIAL, FILE_FOR_FUTURE_REFERENCE, NOT_SUITABLE]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Paginated list of reports }
 *       401: { description: Not authenticated }
 *       403: { description: Access denied - scouts only }
 *       500: { description: Server error }
 */
// ✅ SCOUT only - view all reports
router.get('/', authenticate, authorizeRoles('SCOUT'), scoutReportController.getAll);

/**
 * @swagger
 * /api/scoutReports/{id}:
 *   get:
 *     summary: Get a scout report by ID
 *     tags: [Scout Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Report found }
 *       400: { description: Invalid report ID }
 *       401: { description: Not authenticated }
 *       403: { description: Access denied - scouts only }
 *       404: { description: Report not found }
 *       500: { description: Server error }
 */
// ✅ SCOUT only - view a single report
router.get('/:id', authenticate, authorizeRoles('SCOUT'), scoutReportController.getById);

/**
 * @swagger
 * /api/scoutReports/{id}:
 *   put:
 *     summary: Update a scout report (only the scout who filed it)
 *     tags: [Scout Reports]
 *     security:
 *       - bearerAuth: []
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
 *             $ref: '#/components/schemas/ScoutReportUpdate'
 *     responses:
 *       200: { description: Report updated successfully }
 *       400: { description: Invalid report ID }
 *       401: { description: Not authenticated }
 *       403: { description: Not the report owner }
 *       404: { description: Report not found }
 *       500: { description: Server error }
 */
// ✅ SCOUT only - update their own report
router.put('/:id', authenticate, authorizeRoles('SCOUT'), scoutReportController.update);

/**
 * @swagger
 * /api/scoutReports/{id}:
 *   delete:
 *     summary: Delete a scout report
 *     tags: [Scout Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Report deleted successfully }
 *       400: { description: Invalid report ID }
 *       401: { description: Not authenticated }
 *       403: { description: Access denied - scouts only }
 *       404: { description: Report not found }
 *       500: { description: Server error }
 */
// ✅ SCOUT only - delete their own report
router.delete('/:id', authenticate, authorizeRoles('SCOUT'), scoutReportController.delete);

export default router;