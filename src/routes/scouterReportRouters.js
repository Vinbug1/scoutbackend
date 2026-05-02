import express from 'express';
import scouterReportController from '../controllers/scouterReportController.js';

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
 *         firstTouch:           { type: integer, minimum: 1, maximum: 10 }
 *         ballControl:          { type: integer, minimum: 1, maximum: 10 }
 *         dribbling:            { type: integer, minimum: 1, maximum: 10 }
 *         passingShort:         { type: integer, minimum: 1, maximum: 10 }
 *         passingLong:          { type: integer, minimum: 1, maximum: 10 }
 *         throughBalls:         { type: integer, minimum: 1, maximum: 10 }
 *         smartPass:            { type: integer, minimum: 1, maximum: 10 }
 *         shooting:             { type: integer, minimum: 1, maximum: 10 }
 *         heading:              { type: integer, minimum: 1, maximum: 10 }
 *         tackling:             { type: integer, minimum: 1, maximum: 10 }
 *         weakerFoot:           { type: integer, minimum: 1, maximum: 10 }
 *         positionalAwareness:  { type: integer, minimum: 1, maximum: 10 }
 *         decisionMaking:       { type: integer, minimum: 1, maximum: 10 }
 *         movementOffBall:      { type: integer, minimum: 1, maximum: 10 }
 *         gameIntelligence:     { type: integer, minimum: 1, maximum: 10 }
 *         transitions:          { type: integer, minimum: 1, maximum: 10 }
 *         pace:                 { type: integer, minimum: 1, maximum: 10 }
 *         agilityBalance:       { type: integer, minimum: 1, maximum: 10 }
 *         strength:             { type: integer, minimum: 1, maximum: 10 }
 *         staminaWorkRate:      { type: integer, minimum: 1, maximum: 10 }
 *         jumpingRate:          { type: integer, minimum: 1, maximum: 10 }
 *         composure:            { type: integer, minimum: 1, maximum: 10 }
 *         braveryCommitment:    { type: integer, minimum: 1, maximum: 10 }
 *         determination:        { type: integer, minimum: 1, maximum: 10 }
 *         leadershipCommunication: { type: integer, minimum: 1, maximum: 10 }
 *         coachability:         { type: integer, minimum: 1, maximum: 10 }
 *
 *     ScouterReportInput:
 *       type: object
 *       required:
 *         - scouterId
 *         - playerId
 *       allOf:
 *         - $ref: '#/components/schemas/AttributeScores'
 *       properties:
 *         scouterId:
 *           type: integer
 *         playerId:
 *           type: integer
 *         matchScouted:
 *           type: string
 *         ageGroup:
 *           type: string
 *         timesSeen:
 *           type: integer
 *         currentClub:
 *           type: string
 *         overallAssessment:
 *           type: string
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
 *         scouterId: 5
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
 *     ScouterReportUpdate:
 *       type: object
 *       description: All fields optional — only send what changed. scouterId required for ownership check.
 *       allOf:
 *         - $ref: '#/components/schemas/AttributeScores'
 *       properties:
 *         scouterId:
 *           type: integer
 *           description: Required to verify report ownership
 *         matchScouted:       { type: string }
 *         ageGroup:           { type: string }
 *         timesSeen:          { type: integer }
 *         currentClub:        { type: string }
 *         overallAssessment:  { type: string }
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
 *     ScouterReport:
 *       allOf:
 *         - $ref: '#/components/schemas/ScouterReportInput'
 *       properties:
 *         id:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         scouter:
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
 *   name: Scouter Reports
 *   description: Scouting report management — scouts only
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
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: User is not a scout
 *       404:
 *         description: Player not found
 *       500:
 *         description: Server error
 */
router.post('/', scouterReportController.create);

/**
 * @swagger
 * /api/scouterReports:
 *   get:
 *     summary: Get all scouter reports
 *     tags: [Scouter Reports]
 *     parameters:
 *       - in: query
 *         name: scouterId
 *         schema: { type: integer }
 *         description: Filter by scouter
 *       - in: query
 *         name: playerId
 *         schema: { type: integer }
 *         description: Filter by player
 *       - in: query
 *         name: recommendation
 *         schema:
 *           type: string
 *           enum: [RECOMMEND_FOR_TRIAL, FILE_FOR_FUTURE_REFERENCE, NOT_SUITABLE]
 *         description: Filter by recommendation outcome
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Paginated list of reports
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ScouterReport'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:      { type: integer }
 *                     page:       { type: integer }
 *                     limit:      { type: integer }
 *                     totalPages: { type: integer }
 *       500:
 *         description: Server error
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
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Report found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScouterReport'
 *       400:
 *         description: Invalid report ID
 *       404:
 *         description: Report not found
 *       500:
 *         description: Server error
 */
router.get('/:id', scouterReportController.getById);

/**
 * @swagger
 * /api/scouterReports/{id}:
 *   put:
 *     summary: Update a scouter report (scouter who filed it only)
 *     tags: [Scouter Reports]
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
 *             $ref: '#/components/schemas/ScouterReportUpdate'
 *     responses:
 *       200:
 *         description: Report updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScouterReport'
 *       400:
 *         description: Invalid report ID
 *       403:
 *         description: Not the report owner
 *       404:
 *         description: Report not found
 *       500:
 *         description: Server error
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
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Report deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *             example:
 *               message: "Report deleted successfully"
 *       400:
 *         description: Invalid report ID
 *       404:
 *         description: Report not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', scouterReportController.delete);

export default router;









// import express from 'express';
// const router = express.Router();
// import scouterReportController from '../controllers/scouterReportController.js';

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     ScouterReport:
//  *       type: object
//  *       required:
//  *         - scouterId
//  *         - playerId
//  *         - title
//  *         - report
//  *       properties:
//  *         id:
//  *           type: integer
//  *           description: Auto-generated report ID
//  *         scouterId:
//  *           type: integer
//  *           description: ID of the scouter who created the report
//  *         playerId:
//  *           type: integer
//  *           description: ID of the player being scouted
//  *         title:
//  *           type: string
//  *           description: Title of the scouting report
//  *         report:
//  *           type: string
//  *           description: Detailed scouting report content
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           description: Timestamp when report was created
//  *         updatedAt:
//  *           type: string
//  *           format: date-time
//  *           description: Timestamp when report was last updated
//  *       example:
//  *         id: 1
//  *         scouterId: 5
//  *         playerId: 10
//  *         title: "Midfield Performance Analysis"
//  *         report: "Excellent ball control and vision. Shows great potential in attacking plays."
//  *         createdAt: "2024-01-15T10:30:00Z"
//  *         updatedAt: "2024-01-15T10:30:00Z"
//  *     
//  *     ScouterReportInput:
//  *       type: object
//  *       required:
//  *         - scouterId
//  *         - playerId
//  *         - title
//  *         - report
//  *       properties:
//  *         scouterId:
//  *           type: integer
//  *           description: ID of the scouter
//  *         playerId:
//  *           type: integer
//  *           description: ID of the player
//  *         title:
//  *           type: string
//  *           description: Report title
//  *         report:
//  *           type: string
//  *           description: Report content
//  *       example:
//  *         scouterId: 5
//  *         playerId: 10
//  *         title: "Midfield Performance Analysis"
//  *         report: "Excellent ball control and vision."
//  *     
//  *     ScouterReportUpdate:
//  *       type: object
//  *       properties:
//  *         title:
//  *           type: string
//  *           description: Updated report title
//  *         report:
//  *           type: string
//  *           description: Updated report content
//  *       example:
//  *         title: "Updated Midfield Analysis"
//  *         report: "Shows consistent improvement in passing accuracy."
//  *     
//  *     Error:
//  *       type: object
//  *       properties:
//  *         error:
//  *           type: string
//  *           description: Error message
//  *       example:
//  *         error: "Failed to create report"
//  */

// /**
//  * @swagger
//  * tags:
//  *   name: Scouter Reports
//  *   description: Scouter report management API
//  */

// /**
//  * @swagger
//  * /api/scouterReports:
//  *   post:
//  *     summary: Create a new scouter report
//  *     tags: [Scouter Reports]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/ScouterReportInput'
//  *     responses:
//  *       201:
//  *         description: Report created successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ScouterReport'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.post('/', scouterReportController.create);

// /**
//  * @swagger
//  * /api/scouterReports:
//  *   get:
//  *     summary: Get all scouter reports
//  *     tags: [Scouter Reports]
//  *     description: Retrieves all scouter reports with scouter and player details
//  *     responses:
//  *       200:
//  *         description: List of all scouter reports
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items:
//  *                 $ref: '#/components/schemas/ScouterReport'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/', scouterReportController.getAll);

// /**
//  * @swagger
//  * /api/scouterReports/{id}:
//  *   get:
//  *     summary: Get a scouter report by ID
//  *     tags: [Scouter Reports]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The report ID
//  *     responses:
//  *       200:
//  *         description: Scouter report details
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ScouterReport'
//  *       404:
//  *         description: Report not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *             example:
//  *               error: "Report not found"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/:id', scouterReportController.getById);

// /**
//  * @swagger
//  * /api/scouterReports/{id}:
//  *   put:
//  *     summary: Update a scouter report
//  *     tags: [Scouter Reports]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The report ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/ScouterReportUpdate'
//  *     responses:
//  *       200:
//  *         description: Report updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ScouterReport'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.put('/:id', scouterReportController.update);

// /**
//  * @swagger
//  * /api/scouterReports/{id}:
//  *   delete:
//  *     summary: Delete a scouter report
//  *     tags: [Scouter Reports]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The report ID
//  *     responses:
//  *       200:
//  *         description: Report deleted successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *             example:
//  *               message: "Report deleted successfully"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.delete('/:id', scouterReportController.delete);

// export default router;