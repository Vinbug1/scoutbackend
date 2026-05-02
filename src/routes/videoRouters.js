import { Router } from 'express';
import { upload }  from './media-upload.js';
import {handleVideoUpload,handleAvatarUpload,handleGetUserVideos,handleGetMyProfile,handleGetVideo,} from './video.controller.js';

// import { protect, optionalAuth } from './middlewares/auth.js';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /videos/upload:
 *   post:
 *     summary: Upload a video
 *     description: |
 *       Accepts any common video format (MP4, MOV, AVI, WEBM).
 *       If the file is **not already HLS**, the server automatically converts it
 *       to an HLS stream (`.m3u8` + `.ts` segments) using FFmpeg before storing
 *       it on Google Cloud Storage.
 *
 *       The returned `videoUrl` is the public `.m3u8` playlist URL — use any
 *       HLS-compatible player (hls.js, Video.js, native Safari) to stream it.
 *     tags:
 *       - Videos
 *     security:
 *       - BearerAuth: []
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
 *                 description: Video file (MP4 / MOV / AVI / WEBM). Max 500 MB.
 *               title:
 *                 type: string
 *                 example: Skill showcase – March 2025
 *               description:
 *                 type: string
 *                 example: Highlights from the Lagos regional trials.
 *               published:
 *                 type: string
 *                 enum: ['true', 'false']
 *                 default: 'false'
 *                 description: Pass "true" to publish immediately.
 *     responses:
 *       201:
 *         description: Video uploaded and converted to HLS successfully.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Video'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/videos/upload',protect, upload.single('video'),handleVideoUpload);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/avatar:
 *   post:
 *     summary: Upload or replace profile avatar
 *     description: |
 *       Accepts a **JPEG or PNG** image (max 15 MB). The image is resized to a
 *       maximum width of 1024 px and compressed before being stored on GCS.
 *       Calling this endpoint again replaces the previous avatar URL.
 *     tags:
 *       - Profile
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: JPEG or PNG image. Max 15 MB.
 *     responses:
 *       200:
 *         description: Avatar updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Profile'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/users/avatar',protect,upload.single('avatar'),handleAvatarUpload );

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /me:
 *   get:
 *     summary: Get my profile with all videos and reviews
 *     description: |
 *       Returns the authenticated user's full profile plus **all of their
 *       videos**, each enriched with comments (with commenter avatars), ratings,
 *       a computed `averageRating`, and view / comment / rating counts.
 *     tags:
 *       - Me
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile and videos returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/MyProfile'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/me', protect, handleGetMyProfile);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/{userId}/videos:
 *   get:
 *     summary: Get all videos for a player
 *     description: |
 *       Public endpoint. Returns every video belonging to the player identified
 *       by `userId`, each with its comments, ratings, a computed
 *       `averageRating`, and aggregate counts.
 *     tags:
 *       - Videos
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 7
 *         description: The player's user ID.
 *     responses:
 *       200:
 *         description: List of videos returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Video'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/users/:userId/videos', handleGetUserVideos);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /videos/{videoId}:
 *   get:
 *     summary: Get a single video with reviews
 *     description: |
 *       Public endpoint. Returns full video details including the uploader's
 *       profile stub, all comments with commenter avatars, all ratings, a
 *       computed `averageRating`, and aggregate counts.
 *
 *       **View tracking**: every call records a view.
 *       - Authenticated requests are deduplicated per `userId`.
 *       - Anonymous requests are deduplicated by a hashed IP address.
 *
 *       Passing a JWT is optional but enables user-scoped view deduplication.
 *     tags:
 *       - Videos
 *     security:
 *       - {}
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 10
 *         description: The video's ID.
 *     responses:
 *       200:
 *         description: Video returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/VideoDetail'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/videos/:videoId', optionalAuth, handleGetVideo);

export default router;

/* ─────────────────────────────────────────────────────────────────────────────
   Wire everything up in app.js / server.js:

     import express           from 'express';
     import videoRouter       from './video.routes.js';
     import { mountSwagger }  from './swagger.js';

     const app = express();
     app.use(express.json());

     mountSwagger(app);                 // /api/docs  &  /api/docs.json
     app.use('/api', videoRouter);

   Install:
     npm install swagger-jsdoc swagger-ui-express
───────────────────────────────────────────────────────────────────────────── */





















// import express from "express";
// import videoController from "../controllers/videoController.js";

// const router = express.Router();

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     Video:
//  *       type: object
//  *       required:
//  *         - videoUrl
//  *         - title
//  *         - playerId
//  *       properties:
//  *         id:
//  *           type: integer
//  *           description: Auto-generated video ID
//  *         videoUrl:
//  *           type: string
//  *           description: URL of the video file
//  *         thumbnailUrl:
//  *           type: string
//  *           description: URL of the video thumbnail
//  *         title:
//  *           type: string
//  *           description: Video title
//  *         description:
//  *           type: string
//  *           description: Video description
//  *         published:
//  *           type: boolean
//  *           description: Publication status
//  *           default: false
//  *         durationSec:
//  *           type: integer
//  *           description: Video duration in seconds
//  *         playerId:
//  *           type: integer
//  *           description: ID of the player who uploaded the video
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           description: Creation timestamp
//  *         updatedAt:
//  *           type: string
//  *           format: date-time
//  *           description: Last update timestamp
//  *       example:
//  *         id: 1
//  *         videoUrl: "https://example.com/videos/sample.mp4"
//  *         thumbnailUrl: "https://example.com/thumbnails/sample.jpg"
//  *         title: "Amazing Football Goal"
//  *         description: "Watch this incredible goal from last night's match"
//  *         published: true
//  *         durationSec: 120
//  *         playerId: 5
//  *         createdAt: "2024-01-15T10:30:00Z"
//  *         updatedAt: "2024-01-15T10:30:00Z"
//  *
//  *     VideoInput:
//  *       type: object
//  *       required:
//  *         - videoUrl
//  *         - title
//  *         - playerId
//  *       properties:
//  *         videoUrl:
//  *           type: string
//  *         thumbnailUrl:
//  *           type: string
//  *         title:
//  *           type: string
//  *         description:
//  *           type: string
//  *         published:
//  *           type: boolean
//  *         durationSec:
//  *           type: integer
//  *         playerId:
//  *           type: integer
//  *
//  *     VideoUpdateInput:
//  *       type: object
//  *       properties:
//  *         videoUrl:
//  *           type: string
//  *         thumbnailUrl:
//  *           type: string
//  *         title:
//  *           type: string
//  *         description:
//  *           type: string
//  *         published:
//  *           type: boolean
//  *         durationSec:
//  *           type: integer
//  *
//  *     ErrorResponse:
//  *       type: object
//  *       properties:
//  *         success:
//  *           type: boolean
//  *           example: false
//  *         message:
//  *           type: string
//  *           example: "Server Error"
//  *
//  *     SuccessResponse:
//  *       type: object
//  *       properties:
//  *         success:
//  *           type: boolean
//  *           example: true
//  *         data:
//  *           type: object
//  */

// /**
//  * @swagger
//  * /api/videos:
//  *   post:
//  *     summary: Create a new video
//  *     tags: [Videos]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/VideoInput'
//  *     responses:
//  *       201:
//  *         description: Video created successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 data:
//  *                   $ref: '#/components/schemas/Video'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ErrorResponse'
//  */
// router.post("/", videoController.createVideo);

// /**
//  * @swagger
//  * /api/videos:
//  *   get:
//  *     summary: Get all videos with pagination and filters
//  *     tags: [Videos]
//  *     parameters:
//  *       - in: query
//  *         name: page
//  *         schema:
//  *           type: integer
//  *           default: 1
//  *         description: Page number
//  *       - in: query
//  *         name: limit
//  *         schema:
//  *           type: integer
//  *           default: 20
//  *         description: Number of items per page
//  *       - in: query
//  *         name: published
//  *         schema:
//  *           type: string
//  *           enum: [true, false]
//  *         description: Filter by publication status
//  *     responses:
//  *       200:
//  *         description: List of videos retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 data:
//  *                   type: array
//  *                   items:
//  *                     $ref: '#/components/schemas/Video'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ErrorResponse'
//  */
// router.get("/", videoController.getAllVideos);

// /**
//  * @swagger
//  * /api/videos/{id}:
//  *   get:
//  *     summary: Get a single video by ID
//  *     tags: [Videos]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: Video ID
//  *     responses:
//  *       200:
//  *         description: Video retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 data:
//  *                   $ref: '#/components/schemas/Video'
//  *       404:
//  *         description: Video not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Video not found"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ErrorResponse'
//  */
// router.get("/:id", videoController.getVideoById);

// /**
//  * @swagger
//  * /api/videos/{id}:
//  *   put:
//  *     summary: Update a video
//  *     tags: [Videos]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: Video ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/VideoUpdateInput'
//  *     responses:
//  *       200:
//  *         description: Video updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 data:
//  *                   $ref: '#/components/schemas/Video'
//  *       404:
//  *         description: Video not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Video not found"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ErrorResponse'
//  */
// router.put("/:id", videoController.updateVideo);

// /**
//  * @swagger
//  * /api/videos/{id}:
//  *   delete:
//  *     summary: Delete a video
//  *     tags: [Videos]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: Video ID
//  *     responses:
//  *       200:
//  *         description: Video deleted successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "Video deleted"
//  *       404:
//  *         description: Video not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Video not found"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ErrorResponse'
//  */
// router.delete("/:id", videoController.deleteVideo);

// export default router;