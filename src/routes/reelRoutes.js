import { Router } from 'express';
import { handleUploadFields } from '../config/multer.js';
import {
  handleReelUpload,
  handleGetUserReels,
  handleGetReel,
} from '../controllers/reelController.js';
import { verifyToken as protect } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Reels
 *   description: Skill reel upload and retrieval
 */

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /reels/upload:
 *   post:
 *     summary: Upload a skill reel
 *     description: |
 *       Uploads a skill reel video for the authenticated player.
 *       A `categoryId` is **required** — reels must belong to a skill category
 *       (e.g. Dribbling, Shooting, Agility, Speed).
 *
 *       The file is converted to HLS (`.m3u8` + `.ts` segments) via FFmpeg
 *       and stored on Google Cloud Storage. The response is immediate (202)
 *       and processing continues in the background — poll `GET /reels/:reelId`
 *       to check when `status` becomes `ready`.
 *     tags:
 *       - Reels
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
 *               - categoryId
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
 *                 example: My Dribbling Reel
 *               description:
 *                 type: string
 *                 example: Lagos trials 2026
 *               published:
 *                 type: string
 *                 enum: ['true', 'false']
 *                 default: 'false'
 *                 description: Pass "true" to publish immediately.
 *               categoryId:
 *                 type: integer
 *                 description: Required. ID of the skill category this reel belongs to.
 *                 example: 3
 *     responses:
 *       202:
 *         description: Reel received and processing in background.
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
 *                   example: Reel received. Processing in background.
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
 *                       example: My Dribbling Reel
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/upload', protect, handleUploadFields, handleReelUpload);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/{userId}/reels:
 *   get:
 *     summary: Get all reels for a player
 *     description: |
 *       Public endpoint. Returns every skill reel belonging to the player
 *       identified by `userId`, each with its category (including `categoryType`),
 *       comments, ratings, a computed `averageRating`, and aggregate counts.
 *     tags:
 *       - Reels
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
 *         description: List of reels returned successfully.
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
 *                         $ref: '#/components/schemas/Reel'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/users/:userId/reels', handleGetUserReels);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /reels/{reelId}:
 *   get:
 *     summary: Get a single reel with reviews
 *     description: |
 *       Public endpoint. Returns full reel details including the uploader's
 *       profile stub, category (with `categoryType`), all comments with
 *       commenter avatars, all ratings, a computed `averageRating`, and
 *       aggregate counts.
 *
 *       **View tracking**: every call records a view.
 *       - Authenticated requests are deduplicated per `userId`.
 *       - Anonymous requests are deduplicated by a hashed IP address.
 *     tags:
 *       - Reels
 *     security:
 *       - {}
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reelId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 5
 *         description: The reel's ID.
 *     responses:
 *       200:
 *         description: Reel returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ReelDetail'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:reelId', protect, handleGetReel);

export default router;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *
 *     Reel:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         videoUrl:
 *           type: string
 *           example: https://storage.googleapis.com/scouter_bucket/reels_7_.../index.m3u8
 *         thumbnailUrl:
 *           type: string
 *           nullable: true
 *           example: https://storage.googleapis.com/scouter_bucket/reels_7_.../thumb.jpg
 *         title:
 *           type: string
 *           example: My Dribbling Reel
 *         description:
 *           type: string
 *           nullable: true
 *           example: Lagos trials 2026
 *         published:
 *           type: boolean
 *           example: false
 *         durationSec:
 *           type: integer
 *           nullable: true
 *           example: 45
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
 *           $ref: '#/components/schemas/VideoCategory'
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
 *     ReelDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/Reel'
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
 *   responses:
 *     Forbidden:
 *       description: You do not have permission to perform this action.
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
 *                 example: Only players can upload reels.
 */