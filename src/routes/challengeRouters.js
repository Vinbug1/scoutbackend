import express from 'express';
const router = express.Router();
import ChallengeController from '../controllers/challengeController.js';
import { upload,uploadVideoWithThumbnail  } from '../config/multer.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Challenge:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated challenge ID
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         startAt:
 *           type: string
 *           format: date-time
 *         endAt:
 *           type: string
 *           format: date-time
 *         videoUrl:
 *           type: string
 *           description: HLS master URL of the uploaded challenge video (hosted on GCS)
 *           example: "https://storage.googleapis.com/bucket/challenges/abc123/master.m3u8"
 *         thumbnailUrl:
 *           type: string
 *           description: URL of the auto-generated video thumbnail (hosted on GCS)
 *           example: "https://storage.googleapis.com/bucket/challenges/abc123/thumbnail.jpg"
 *         creatorId:
 *           type: integer
 *           description: ID of the user who created the challenge
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: 1
 *         title: "30-Day Fitness Challenge"
 *         description: "Complete 30 days of daily workouts"
 *         startAt: "2024-01-01T00:00:00.000Z"
 *         endAt: "2024-01-31T23:59:59.000Z"
 *         videoUrl: "https://storage.googleapis.com/bucket/challenges/abc123/master.m3u8"
 *         thumbnailUrl: "https://storage.googleapis.com/bucket/challenges/abc123/thumbnail.jpg"
 *         creatorId: 1
 *         createdAt: "2024-01-01T00:00:00.000Z"
 *         updatedAt: "2024-01-01T00:00:00.000Z"
 */

/**
 * @swagger
 * /api/challenges:
 *   post:
 *     summary: Create a new challenge
 *     tags: [Challenges]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - video
 *               - title
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Challenge video file (required). Uploaded to GCS and transcoded to HLS.
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: Optional thumbnail image. If omitted, a thumbnail is auto-generated from the video.
 *               title:
 *                 type: string
 *                 description: Challenge title
 *               description:
 *                 type: string
 *                 description: Challenge description
 *               startAt:
 *                 type: string
 *                 format: date-time
 *                 description: Challenge start date
 *               endAt:
 *                 type: string
 *                 format: date-time
 *                 description: Challenge end date
 *     responses:
 *       201:
 *         description: Challenge created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Challenge created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Challenge'
 *       400:
 *         description: Missing required video file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "A video file is required."
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', uploadVideoWithThumbnail, ChallengeController.createChallenge);

/**
 * @swagger
 * /api/challenges/{id}:
 *   put:
 *     summary: Update a challenge
 *     tags: [Challenges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Challenge ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Replacement video file. If provided, re-uploaded and re-transcoded to HLS.
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: Replacement thumbnail image.
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startAt:
 *                 type: string
 *                 format: date-time
 *               endAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Challenge updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Challenge updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Challenge'
 *       403:
 *         description: Not authorized to update this challenge
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Not authorized to update this challenge"
 *       404:
 *         description: Challenge not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Challenge not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', uploadVideoWithThumbnail, ChallengeController.updateChallenge);

/**
 * @swagger
 * /api/challenges:
 *   get:
 *     summary: Get all challenges
 *     tags: [Challenges]
 *     responses:
 *       200:
 *         description: List of all challenges
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Challenge'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', ChallengeController.getAllChallenges);

/**
 * @swagger
 * /api/challenges/{id}:
 *   get:
 *     summary: Get a challenge by ID
 *     tags: [Challenges]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Challenge ID
 *     responses:
 *       200:
 *         description: Challenge details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Challenge'
 *       404:
 *         description: Challenge not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Challenge not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', ChallengeController.getChallengeById);


/**
 * @swagger
 * /api/challenges/{id}:
 *   delete:
 *     summary: Delete a challenge
 *     tags: [Challenges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Challenge ID
 *     responses:
 *       200:
 *         description: Challenge deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Challenge deleted successfully"
 *       404:
 *         description: Challenge not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Challenge not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', ChallengeController.deleteChallenge);

export default router;





















// import express from 'express';
// const router = express.Router();
// import challengeController from '../controllers/challengeController.js';

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     Challenge:
//  *       type: object
//  *       required:
//  *         - title
//  *         - creatorId
//  *       properties:
//  *         id:
//  *           type: integer
//  *           description: Auto-generated challenge ID
//  *         title:
//  *           type: string
//  *           description: Challenge title
//  *         description:
//  *           type: string
//  *           description: Challenge description
//  *         startAt:
//  *           type: string
//  *           format: date-time
//  *           description: Challenge start date
//  *         endAt:
//  *           type: string
//  *           format: date-time
//  *           description: Challenge end date
//  *         creatorId:
//  *           type: integer
//  *           description: ID of the user who created the challenge
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           description: Timestamp when challenge was created
//  *         updatedAt:
//  *           type: string
//  *           format: date-time
//  *           description: Timestamp when challenge was last updated
//  *       example:
//  *         id: 1
//  *         title: "30-Day Fitness Challenge"
//  *         description: "Complete 30 days of daily workouts"
//  *         startAt: "2024-01-01T00:00:00.000Z"
//  *         endAt: "2024-01-31T23:59:59.000Z"
//  *         creatorId: 1
//  *         createdAt: "2024-01-01T00:00:00.000Z"
//  *         updatedAt: "2024-01-01T00:00:00.000Z"
//  *     
//  *     ChallengeInput:
//  *       type: object
//  *       required:
//  *         - title
//  *         - creatorId
//  *       properties:
//  *         title:
//  *           type: string
//  *         description:
//  *           type: string
//  *         startAt:
//  *           type: string
//  *           format: date-time
//  *         endAt:
//  *           type: string
//  *           format: date-time
//  *         creatorId:
//  *           type: integer
//  *       example:
//  *         title: "30-Day Fitness Challenge"
//  *         description: "Complete 30 days of daily workouts"
//  *         startAt: "2024-01-01T00:00:00.000Z"
//  *         endAt: "2024-01-31T23:59:59.000Z"
//  *         creatorId: 1
//  *     
//  *     ChallengeUpdate:
//  *       type: object
//  *       properties:
//  *         title:
//  *           type: string
//  *         description:
//  *           type: string
//  *         startAt:
//  *           type: string
//  *           format: date-time
//  *         endAt:
//  *           type: string
//  *           format: date-time
//  *       example:
//  *         title: "Updated Challenge Title"
//  *         description: "Updated description"
//  *     
//  *     Error:
//  *       type: object
//  *       properties:
//  *         error:
//  *           type: string
//  *       example:
//  *         error: "Failed to fetch challenge"
//  *     
//  *     Success:
//  *       type: object
//  *       properties:
//  *         message:
//  *           type: string
//  *         data:
//  *           $ref: '#/components/schemas/Challenge'
//  */

// /**
//  * @swagger
//  * tags:
//  *   name: Challenges
//  *   description: Challenge management API
//  */

// /**
//  * @swagger
//  * /api/challenges:
//  *   post:
//  *     summary: Create a new challenge
//  *     tags: [Challenges]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/ChallengeInput'
//  *     responses:
//  *       201:
//  *         description: Challenge created successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *                   example: "Challenge created successfully"
//  *                 data:
//  *                   $ref: '#/components/schemas/Challenge'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.post('/', challengeController.createChallenge);

// /**
//  * @swagger
//  * /api/challenges:
//  *   get:
//  *     summary: Get all challenges
//  *     tags: [Challenges]
//  *     responses:
//  *       200:
//  *         description: List of all challenges
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items:
//  *                 $ref: '#/components/schemas/Challenge'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/', challengeController.getAllChallenges);

// /**
//  * @swagger
//  * /api/challenges/{id}:
//  *   get:
//  *     summary: Get a challenge by ID
//  *     tags: [Challenges]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         schema:
//  *           type: integer
//  *         required: true
//  *         description: Challenge ID
//  *     responses:
//  *       200:
//  *         description: Challenge details
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Challenge'
//  *       404:
//  *         description: Challenge not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *             example:
//  *               error: "Challenge not found"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/:id', challengeController.getChallengeById);

// /**
//  * @swagger
//  * /api/challenges/{id}:
//  *   put:
//  *     summary: Update a challenge
//  *     tags: [Challenges]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         schema:
//  *           type: integer
//  *         required: true
//  *         description: Challenge ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/ChallengeUpdate'
//  *     responses:
//  *       200:
//  *         description: Challenge updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *                   example: "Challenge updated successfully"
//  *                 data:
//  *                   $ref: '#/components/schemas/Challenge'
//  *       404:
//  *         description: Challenge not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *             example:
//  *               error: "Challenge not found"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.put('/:id', challengeController.updateChallenge);

// /**
//  * @swagger
//  * /api/challenges/{id}:
//  *   delete:
//  *     summary: Delete a challenge
//  *     tags: [Challenges]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         schema:
//  *           type: integer
//  *         required: true
//  *         description: Challenge ID
//  *     responses:
//  *       200:
//  *         description: Challenge deleted successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *                   example: "Challenge deleted successfully"
//  *       404:
//  *         description: Challenge not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *             example:
//  *               error: "Challenge not found"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.delete('/:id', challengeController.deleteChallenge);

// export default router;