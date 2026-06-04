import { Router } from 'express';
import { upload, uploadVideoWithThumbnail, handleUploadFields } from '../config/multer.js';
import {
  handleVideoUpload,
  handleAvatarUpload,
  handleGetUserVideos,
  handleGetMyProfile,
  handleGetVideo,
} from '../controllers/videoController.js';
import { verifyToken as protect } from '../middleware/auth.js';

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
 *
 *       Videos with the title **"challenges"** will not include a `category` field
 *       in the response.
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
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: Optional thumbnail image (JPEG / PNG). Auto-compressed to 1024px.
 *               title:
 *                 type: string
 *                 example: Player Highlight
 *               description:
 *                 type: string
 *                 example: Scouted at Lagos trials
 *               published:
 *                 type: string
 *                 enum: ['true', 'false']
 *                 default: 'false'
 *                 description: Pass "true" to publish immediately.
 *               categoryId:
 *                 type: integer
 *                 nullable: true
 *                 description: ID of the video category (e.g. a SKILL category). Omit for challenge videos.
 *                 example: 3
 *     responses:
 *       202:
 *         description: Video received and processing in background.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Video received. Processing in background.
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     status:
 *                       type: string
 *                       example: processing
 *                     title:
 *                       type: string
 *                       example: Player Highlight
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/upload', protect, handleUploadFields, handleVideoUpload);

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
router.post('/users/avatar', protect, upload.single('avatar'), handleAvatarUpload);

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
 *
 *       Videos with the title **"challenges"** will not include a `category` field.
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
 *
 *       Videos with the title **"challenges"** will not include a `category` field.
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
 *       Videos with the title **"challenges"** will not include a `category` field.
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
router.get('/videos/:videoId', protect, handleGetVideo);

export default router;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *
 *     VideoCategory:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 3
 *         title:
 *           type: string
 *           example: Dribbling
 *         categoryType:
 *           type: string
 *           enum: [SKILL, GENERAL, TACTICAL, PHYSICAL]
 *           example: SKILL
 *
 *     Video:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         videoUrl:
 *           type: string
 *           example: https://storage.googleapis.com/scouter_bucket/videos_7_.../index.m3u8
 *         thumbnailUrl:
 *           type: string
 *           nullable: true
 *           example: https://storage.googleapis.com/scouter_bucket/thumbnails_7_.../image.jpg
 *         title:
 *           type: string
 *           example: Player Highlight
 *         description:
 *           type: string
 *           nullable: true
 *           example: Scouted at Lagos trials
 *         published:
 *           type: boolean
 *           example: false
 *         durationSec:
 *           type: integer
 *           nullable: true
 *           example: 19
 *         status:
 *           type: string
 *           example: ready
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2026-05-13T10:19:59.801Z
 *         playerId:
 *           type: integer
 *           example: 7
 *         category:
 *           nullable: true
 *           description: Omitted entirely for videos titled "challenges".
 *           allOf:
 *             - $ref: '#/components/schemas/VideoCategory'
 *         averageRating:
 *           type: number
 *           nullable: true
 *           example: 4.5
 *         _count:
 *           type: object
 *           properties:
 *             views:
 *               type: integer
 *               example: 120
 *             comments:
 *               type: integer
 *               example: 8
 *             ratings:
 *               type: integer
 *               example: 15
 *
 *     VideoDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/Video'
 *         - type: object
 *           properties:
 *             player:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 7
 *                 fullname:
 *                   type: string
 *                   example: John Doe
 *                 profile:
 *                   type: object
 *                   properties:
 *                     avatarUrl:
 *                       type: string
 *                       nullable: true
 *                     position:
 *                       type: string
 *                       nullable: true
 *                       example: Forward
 *                     country:
 *                       type: string
 *                       nullable: true
 *                       example: Nigeria
 *             comments:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   text:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   user:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       fullname:
 *                         type: string
 *                       profile:
 *                         type: object
 *                         properties:
 *                           avatarUrl:
 *                             type: string
 *                             nullable: true
 *             ratings:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   score:
 *                     type: integer
 *                     example: 5
 *                   user:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       fullname:
 *                         type: string
 *
 *     MyProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 7
 *         email:
 *           type: string
 *           example: player@example.com
 *         fullname:
 *           type: string
 *           example: John Doe
 *         role:
 *           type: string
 *           enum: [PLAYER, SCOUT, ADMIN]
 *           example: PLAYER
 *         profile:
 *           $ref: '#/components/schemas/Profile'
 *         videos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Video'
 *
 *     Profile:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         userId:
 *           type: integer
 *         avatarUrl:
 *           type: string
 *           nullable: true
 *         position:
 *           type: string
 *           nullable: true
 *         height:
 *           type: number
 *           nullable: true
 *         favouriteFoot:
 *           type: string
 *           nullable: true
 *         gender:
 *           type: string
 *           nullable: true
 *         country:
 *           type: string
 *           nullable: true
 *         city:
 *           type: string
 *           nullable: true
 *         dob:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         bio:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     SuccessEnvelope:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *
 *   responses:
 *     BadRequest:
 *       description: Bad request — invalid input.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: Video title is required.
 *     Unauthorized:
 *       description: Missing or invalid token.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: Unauthorized.
 *     NotFound:
 *       description: Resource not found.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: Video not found.
 *     ServerError:
 *       description: Internal server error.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: Internal server error.
 */



































// import { Router } from 'express';
// import { upload,uploadVideoWithThumbnail,handleUploadFields  } from '../config/multer.js';
// import { handleVideoUpload, handleAvatarUpload, handleGetUserVideos, handleGetMyProfile, handleGetVideo } from '../controllers/videoController.js';
// import { verifyToken as protect} from '../middleware/auth.js';
// // import { protect, optionalAuth } from './middlewares/auth.js';

// const router = Router();

// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /videos/upload:
//  *   post:
//  *     summary: Upload a video
//  *     description: |
//  *       Accepts any common video format (MP4, MOV, AVI, WEBM).
//  *       If the file is **not already HLS**, the server automatically converts it
//  *       to an HLS stream (`.m3u8` + `.ts` segments) using FFmpeg before storing
//  *       it on Google Cloud Storage.
//  *
//  *       The returned `videoUrl` is the public `.m3u8` playlist URL — use any
//  *       HLS-compatible player (hls.js, Video.js, native Safari) to stream it.
//  *     tags:
//  *       - Videos
//  *     security:
//  *       - BearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         multipart/form-data:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - video
//  *               - title
//  *             properties:
//  *               video:
//  *                 type: string
//  *                 format: binary
//  *                 description: Video file (MP4 / MOV / AVI / WEBM). Max 500 MB.
//  *               thumbnail:
//  *                 type: string
//  *                 format: binary
//  *                 description: Optional thumbnail image (JPEG / PNG). Auto-compressed to 1024px.
//  *               title:
//  *                 type: string
//  *                 example: Player Highlight
//  *               description:
//  *                 type: string
//  *                 example: Scouted at Lagos trials
//  *               published:
//  *                 type: string
//  *                 enum: ['true', 'false']
//  *                 default: 'false'
//  *                 description: Pass "true" to publish immediately.
//  *               playerId:
//  *                 type: integer
//  *                 description: Required only for SCOUT uploads.
//  *                 example: 7
//  *     responses:
//  *       201:
//  *         description: Video uploaded and converted to HLS successfully.
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
//  *                   example: Video uploaded and converted to HLS successfully.
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     id:
//  *                       type: integer
//  *                       example: 1
//  *                     videoUrl:
//  *                       type: string
//  *                       example: https://storage.googleapis.com/scouter_bucket/videos_7_.../index.m3u8
//  *                     thumbnailUrl:
//  *                       type: string
//  *                       nullable: true
//  *                       example: https://storage.googleapis.com/scouter_bucket/thumbnails_7_.../image.jpg
//  *                     title:
//  *                       type: string
//  *                       example: Player Highlight
//  *                     description:
//  *                       type: string
//  *                       example: Scouted at Lagos trials
//  *                     published:
//  *                       type: boolean
//  *                       example: false
//  *                     durationSec:
//  *                       type: integer
//  *                       example: 19
//  *                     createdAt:
//  *                       type: string
//  *                       format: date-time
//  *                       example: 2026-05-13T10:19:59.801Z
//  *                     playerId:
//  *                       type: integer
//  *                       example: 7
//  *       400:
//  *         $ref: '#/components/responses/BadRequest'
//  *       401:
//  *         $ref: '#/components/responses/Unauthorized'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// router.post('/upload', protect, handleUploadFields, handleVideoUpload);
// // ↑ replaces upload.single('video')

// /**
//  * @swagger
//  * /videos/upload:
//  *   post:
//  *     summary: Upload a video
//  *     description: |
//  *       Accepts any common video format (MP4, MOV, AVI, WEBM).
//  *       If the file is **not already HLS**, the server automatically converts it
//  *       to an HLS stream (`.m3u8` + `.ts` segments) using FFmpeg before storing
//  *       it on Google Cloud Storage.
//  *
//  *       The returned `videoUrl` is the public `.m3u8` playlist URL — use any
//  *       HLS-compatible player (hls.js, Video.js, native Safari) to stream it.
//  *     tags:
//  *       - Videos
//  *     security:
//  *       - BearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         multipart/form-data:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - video
//  *               - title
//  *               - playerId
//  *             properties:
//  *               video:
//  *                 type: string
//  *                 format: binary
//  *                 description: Video file (MP4 / MOV / AVI / WEBM). Max 500 MB.
//  *               title:
//  *                 type: string
//  *                 example: Player Highlight
//  *               description:
//  *                 type: string
//  *                 example: Scouted at Lagos trials
//  *               published:
//  *                 type: string
//  *                 enum: ['true', 'false']
//  *                 default: 'false'
//  *                 description: Pass "true" to publish immediately.
//  *               playerId:
//  *                 type: integer
//  *                 description: ID of the player this video belongs to.
//  *                 example: 7
//  *     responses:
//  *       201:
//  *         description: Video uploaded and converted to HLS successfully.
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
//  *                   example: Video uploaded and converted to HLS successfully.
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     id:
//  *                       type: integer
//  *                       example: 1
//  *                     videoUrl:
//  *                       type: string
//  *                       example: https://storage.googleapis.com/scouter_bucket/videos_7_2e395363-2f16-4cfe-9a98-ff4d99acd0aa/index.m3u8
//  *                     thumbnailUrl:
//  *                       type: string
//  *                       nullable: true
//  *                       example: null
//  *                     title:
//  *                       type: string
//  *                       example: Player Highlight
//  *                     description:
//  *                       type: string
//  *                       example: Scouted at Lagos trials
//  *                     published:
//  *                       type: boolean
//  *                       example: false
//  *                     durationSec:
//  *                       type: integer
//  *                       example: 19
//  *                     createdAt:
//  *                       type: string
//  *                       format: date-time
//  *                       example: 2026-05-13T10:19:59.801Z
//  *                     playerId:
//  *                       type: integer
//  *                       example: 7
//  *       400:
//  *         $ref: '#/components/responses/BadRequest'
//  *       401:
//  *         $ref: '#/components/responses/Unauthorized'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// //router.post('/upload', protect, upload.single('video'), handleVideoUpload);
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /users/avatar:
//  *   post:
//  *     summary: Upload or replace profile avatar
//  *     description: |
//  *       Accepts a **JPEG or PNG** image (max 15 MB). The image is resized to a
//  *       maximum width of 1024 px and compressed before being stored on GCS.
//  *       Calling this endpoint again replaces the previous avatar URL.
//  *     tags:
//  *       - Profile
//  *     security:
//  *       - BearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         multipart/form-data:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - avatar
//  *             properties:
//  *               avatar:
//  *                 type: string
//  *                 format: binary
//  *                 description: JPEG or PNG image. Max 15 MB.
//  *     responses:
//  *       200:
//  *         description: Avatar updated successfully.
//  *         content:
//  *           application/json:
//  *             schema:
//  *               allOf:
//  *                 - $ref: '#/components/schemas/SuccessEnvelope'
//  *                 - type: object
//  *                   properties:
//  *                     data:
//  *                       $ref: '#/components/schemas/Profile'
//  *       400:
//  *         $ref: '#/components/responses/BadRequest'
//  *       401:
//  *         $ref: '#/components/responses/Unauthorized'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// router.post('/users/avatar',protect,upload.single('avatar'),handleAvatarUpload );

// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /me:
//  *   get:
//  *     summary: Get my profile with all videos and reviews
//  *     description: |
//  *       Returns the authenticated user's full profile plus **all of their
//  *       videos**, each enriched with comments (with commenter avatars), ratings,
//  *       a computed `averageRating`, and view / comment / rating counts.
//  *     tags:
//  *       - Me
//  *     security:
//  *       - BearerAuth: []
//  *     responses:
//  *       200:
//  *         description: Profile and videos returned successfully.
//  *         content:
//  *           application/json:
//  *             schema:
//  *               allOf:
//  *                 - $ref: '#/components/schemas/SuccessEnvelope'
//  *                 - type: object
//  *                   properties:
//  *                     data:
//  *                       $ref: '#/components/schemas/MyProfile'
//  *       401:
//  *         $ref: '#/components/responses/Unauthorized'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// router.get('/me', protect, handleGetMyProfile);

// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /users/{userId}/videos:
//  *   get:
//  *     summary: Get all videos for a player
//  *     description: |
//  *       Public endpoint. Returns every video belonging to the player identified
//  *       by `userId`, each with its comments, ratings, a computed
//  *       `averageRating`, and aggregate counts.
//  *     tags:
//  *       - Videos
//  *     parameters:
//  *       - in: path
//  *         name: userId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *           example: 7
//  *         description: The player's user ID.
//  *     responses:
//  *       200:
//  *         description: List of videos returned successfully.
//  *         content:
//  *           application/json:
//  *             schema:
//  *               allOf:
//  *                 - $ref: '#/components/schemas/SuccessEnvelope'
//  *                 - type: object
//  *                   properties:
//  *                     data:
//  *                       type: array
//  *                       items:
//  *                         $ref: '#/components/schemas/Video'
//  *       400:
//  *         $ref: '#/components/responses/BadRequest'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// router.get('/users/:userId/videos', handleGetUserVideos);

// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /videos/{videoId}:
//  *   get:
//  *     summary: Get a single video with reviews
//  *     description: |
//  *       Public endpoint. Returns full video details including the uploader's
//  *       profile stub, all comments with commenter avatars, all ratings, a
//  *       computed `averageRating`, and aggregate counts.
//  *
//  *       **View tracking**: every call records a view.
//  *       - Authenticated requests are deduplicated per `userId`.
//  *       - Anonymous requests are deduplicated by a hashed IP address.
//  *
//  *       Passing a JWT is optional but enables user-scoped view deduplication.
//  *     tags:
//  *       - Videos
//  *     security:
//  *       - {}
//  *       - BearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: videoId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *           example: 10
//  *         description: The video's ID.
//  *     responses:
//  *       200:
//  *         description: Video returned successfully.
//  *         content:
//  *           application/json:
//  *             schema:
//  *               allOf:
//  *                 - $ref: '#/components/schemas/SuccessEnvelope'
//  *                 - type: object
//  *                   properties:
//  *                     data:
//  *                       $ref: '#/components/schemas/VideoDetail'
//  *       400:
//  *         $ref: '#/components/responses/BadRequest'
//  *       404:
//  *         $ref: '#/components/responses/NotFound'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// router.get('/videos/:videoId', protect, handleGetVideo);

// export default router;

// /* ─────────────────────────────────────────────────────────────────────────────
//    Wire everything up in app.js / server.js:

//      import express           from 'express';
//      import videoRouter       from './video.routes.js';
//      import { mountSwagger }  from './swagger.js';

//      const app = express();
//      app.use(express.json());

//      mountSwagger(app);                 // /api/docs  &  /api/docs.json
//      app.use('/api', videoRouter);

//    Install:
//      npm install swagger-jsdoc swagger-ui-express
// ───────────────────────────────────────────────────────────────────────────── */

