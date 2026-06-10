import { Router } from 'express';
import { handleUploadFields } from '../config/multer.js';
import {
  handleReelUpload,
  handleGetUserReels,
  handleGetReel,
  handleGetReelsByCategory,
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
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *
 *     VideoCategory:
 *       type: object
 *       description: Category fetched via categoryId — only id and title exist in the schema.
 *       properties:
 *         id:
 *           type: integer
 *           example: 7
 *         title:
 *           type: string
 *           example: Dribbling
 *
 *     PlayerSummary:
 *       type: object
 *       description: Flattened player info derived from User + Profile models.
 *       properties:
 *         id:
 *           type: integer
 *           example: 7
 *         fullname:
 *           type: string
 *           example: John Doe
 *         avatarUrl:
 *           type: string
 *           nullable: true
 *           example: https://storage.googleapis.com/bucket/avatars/7.jpg
 *         position:
 *           type: string
 *           nullable: true
 *           example: Forward
 *         country:
 *           type: string
 *           nullable: true
 *           example: Nigeria
 *         age:
 *           type: integer
 *           nullable: true
 *           description: Computed from Profile.dob at query time. Null if dob not set.
 *           example: 24
 *
 *     ReelStats:
 *       type: object
 *       description: Aggregate engagement counts derived from _count.
 *       properties:
 *         views:
 *           type: integer
 *           description: Total unique views (ReelView records).
 *           example: 120
 *         comments:
 *           type: integer
 *           description: Total comments on this reel.
 *           example: 8
 *         likes:
 *           type: integer
 *           description: Total ratings/likes on this reel (maps to Rating model count).
 *           example: 34
 *
 *     CommentUser:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 3
 *         fullname:
 *           type: string
 *           example: Jane Smith
 *         profile:
 *           type: object
 *           nullable: true
 *           properties:
 *             avatarUrl:
 *               type: string
 *               nullable: true
 *               example: https://storage.googleapis.com/bucket/avatars/3.jpg
 *
 *     ReelComment:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 10
 *         text:
 *           type: string
 *           example: Great footwork!
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2026-05-14T08:00:00.000Z
 *         videoId:
 *           type: integer
 *           nullable: true
 *         reelId:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         postId:
 *           type: integer
 *           nullable: true
 *         userId:
 *           type: integer
 *           example: 3
 *         user:
 *           $ref: '#/components/schemas/CommentUser'
 *
 *     RatingUser:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 5
 *         fullname:
 *           type: string
 *           example: Alex Scout
 *
 *     ReelRating:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 22
 *         score:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           example: 8
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2026-05-13T12:00:00.000Z
 *         videoId:
 *           type: integer
 *           nullable: true
 *         reelId:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         userId:
 *           type: integer
 *           example: 5
 *         user:
 *           $ref: '#/components/schemas/RatingUser'
 *
 *     Reel:
 *       type: object
 *       description: |
 *         Full reel object as returned by formatReel() in reelService.
 *         Includes flattened player info, category, engagement stats,
 *         full comments list, full ratings list, and computed averageRating.
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         videoUrl:
 *           type: string
 *           description: HLS master playlist URL (.m3u8).
 *           example: https://storage.googleapis.com/bucket/reels/1/master.m3u8
 *         thumbnailUrl:
 *           type: string
 *           nullable: true
 *           example: https://storage.googleapis.com/bucket/reels/1/thumb.jpg
 *         title:
 *           type: string
 *           example: My Dribbling Reel
 *         description:
 *           type: string
 *           nullable: true
 *           example: Lagos trials 2026
 *         published:
 *           type: boolean
 *           example: true
 *         durationSec:
 *           type: integer
 *           nullable: true
 *           example: 45
 *         status:
 *           type: string
 *           enum: [processing, ready, failed]
 *           example: ready
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2026-05-13T10:19:59.801Z
 *         playerId:
 *           type: integer
 *           example: 7
 *         categoryId:
 *           type: integer
 *           example: 7
 *         category:
 *           $ref: '#/components/schemas/VideoCategory'
 *         player:
 *           $ref: '#/components/schemas/PlayerSummary'
 *         averageRating:
 *           type: number
 *           format: float
 *           nullable: true
 *           description: Average of all Rating.score values. Null if no ratings yet.
 *           example: 4.5
 *         stats:
 *           $ref: '#/components/schemas/ReelStats'
 *         comments:
 *           type: array
 *           description: All comments on this reel, ordered newest first.
 *           items:
 *             $ref: '#/components/schemas/ReelComment'
 *         ratings:
 *           type: array
 *           description: All rating records on this reel.
 *           items:
 *             $ref: '#/components/schemas/ReelRating'
 *         _count:
 *           type: object
 *           description: Raw Prisma count block (also reflected in stats).
 *           properties:
 *             views:
 *               type: integer
 *               example: 120
 *             comments:
 *               type: integer
 *               example: 8
 *             ratings:
 *               type: integer
 *               example: 34
 *
 *     ReelPending:
 *       type: object
 *       description: Minimal response returned immediately after upload (202).
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         status:
 *           type: string
 *           example: processing
 *         title:
 *           type: string
 *           example: My Dribbling Reel
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
 *     ErrorEnvelope:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *
 *   responses:
 *     BadRequest:
 *       description: Bad request — invalid or missing parameters.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorEnvelope'
 *           example:
 *             success: false
 *             message: A valid categoryId is required.
 *     Unauthorized:
 *       description: Missing or invalid auth token.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorEnvelope'
 *           example:
 *             success: false
 *             message: Unauthorized.
 *     Forbidden:
 *       description: You do not have permission to perform this action.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorEnvelope'
 *           example:
 *             success: false
 *             message: Only players can upload reels.
 *     NotFound:
 *       description: Resource not found.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorEnvelope'
 *           example:
 *             success: false
 *             message: Reel not found.
 *     ServerError:
 *       description: Internal server error.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorEnvelope'
 *           example:
 *             success: false
 *             message: Internal server error.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /reels/upload:
 *   post:
 *     summary: Upload a skill reel
 *     description: |
 *       Authenticated players only. Accepts a video file (and optional thumbnail)
 *       via multipart/form-data. A `categoryId` is required — reels must belong
 *       to an existing VideoCategory.
 *
 *       **Flow:**
 *       1. A `processing` reel record is created immediately in the database.
 *       2. A `202` response is returned right away with the pending reel id.
 *       3. FFmpeg HLS conversion + GCS upload happens in the background.
 *       4. On success the reel status becomes `ready`. On failure it becomes `failed`.
 *
 *       Poll `GET /reels/:reelId` to check `status`.
 *     tags: [Reels]
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
 *                 description: Optional thumbnail image (JPEG / PNG).
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
 *                 description: Pass 'true' to make the reel publicly visible immediately after processing.
 *               categoryId:
 *                 type: integer
 *                 description: ID of the VideoCategory this reel belongs to. Fetch from GET /api/videoCategory.
 *                 example: 7
 *     responses:
 *       202:
 *         description: Reel received and processing started in background.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Reel received. Processing in background.
 *                     data:
 *                       $ref: '#/components/schemas/ReelPending'
 *       400:
 *         description: |
 *           Bad request. Possible causes:
 *           - No video file provided
 *           - Title is missing or blank
 *           - categoryId is missing, non-numeric, or ≤ 0
 *           - categoryId does not exist (Prisma P2003 foreign key violation)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *             examples:
 *               noFile:
 *                 summary: No video file
 *                 value: { success: false, message: 'No video file provided.' }
 *               noTitle:
 *                 summary: Missing title
 *                 value: { success: false, message: 'Reel title is required.' }
 *               badCategory:
 *                 summary: Invalid categoryId
 *                 value: { success: false, message: 'A valid categoryId is required for reels.' }
 *               categoryNotFound:
 *                 summary: categoryId does not exist
 *                 value: { success: false, message: 'Category not found.' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Authenticated user is not a PLAYER.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *             example:
 *               success: false
 *               message: Only players can upload reels.
 *       500:
 *         description: Database or upload failure.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *             example:
 *               success: false
 *               message: Failed to create reel record.
 */
router.post('/upload', protect, handleUploadFields, handleReelUpload);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /reels:
 *   get:
 *     summary: Get all published reels by category
 *     description: |
 *       Public endpoint. Returns all reels where `published = true` and
 *       `categoryId` matches the query param. Each reel includes full player
 *       info (name, position, age, country), category details, all comments
 *       (newest first), all ratings, computed `averageRating`, and engagement
 *       `stats` (views, comments, likes).
 *
 *       Returns 404 if the category exists but has no published reels.
 *     tags: [Reels]
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 7
 *         description: ID of the category to filter by. Must be a positive integer.
 *     responses:
 *       200:
 *         description: Published reels for the category returned successfully.
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
 *         description: categoryId query param is missing, non-numeric, or ≤ 0.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *             example:
 *               success: false
 *               message: A valid categoryId query param is required.
 *       404:
 *         description: No published reels found for this category.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *             example:
 *               success: false
 *               message: No reels found for this category.
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', protect, handleGetReelsByCategory);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /reels/user/{userId}:
 *   get:
 *     summary: Get all reels for a player
 *     description: |
 *       Public endpoint. Returns all reels for the given player (`playerId`),
 *       regardless of `published` status. Optionally filter by `categoryId`.
 *       Each reel includes full player info, category, all comments, all ratings,
 *       computed `averageRating`, and engagement `stats`.
 *
 *       Returns an empty array if the player has no reels (not a 404).
 *     tags: [Reels]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 7
 *         description: The player's User.id.
 *       - in: query
 *         name: categoryId
 *         required: false
 *         schema:
 *           type: integer
 *           example: 7
 *         description: Optional. Filter reels by VideoCategory.id.
 *     responses:
 *       200:
 *         description: Reels returned successfully (may be an empty array).
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
 *         description: userId or categoryId is non-numeric or ≤ 0.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *             examples:
 *               badUserId:
 *                 summary: Invalid userId
 *                 value: { success: false, message: 'Invalid user ID.' }
 *               badCategoryId:
 *                 summary: Invalid categoryId
 *                 value: { success: false, message: 'Invalid category ID.' }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/user/:userId', protect, handleGetUserReels);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /reels/{reelId}:
 *   get:
 *     summary: Get a single reel by ID
 *     description: |
 *       Public endpoint — auth is optional. Returns full reel details.
 *
 *       **View tracking** (via ReelView model):
 *       - Authenticated users: one view recorded per `userId` (unique constraint on reelId + userId).
 *       - Anonymous users: one view recorded per hashed IP (base64 slice of raw IP, max 32 chars).
 *       - Duplicate views are silently ignored (try/catch on the create).
 *
 *       Returns 404 if no reel exists with the given ID (Prisma P2025).
 *     tags: [Reels]
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
 *         description: The Reel.id to fetch.
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
 *                       $ref: '#/components/schemas/Reel'
 *       400:
 *         description: reelId is non-numeric or ≤ 0.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *             example:
 *               success: false
 *               message: Invalid reel ID.
 *       404:
 *         description: No reel found with this ID.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *             example:
 *               success: false
 *               message: Reel not found.
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:reelId', protect, handleGetReel);

export default router;































// import { Router } from 'express';
// import { handleUploadFields } from '../config/multer.js';
// import {
//   handleReelUpload,
//   handleGetUserReels,
//   handleGetReel,
//   handleGetReelsByCategory,
// } from '../controllers/reelController.js';
// import { verifyToken as protect } from '../middleware/auth.js';

// const router = Router();

// /**
//  * @swagger
//  * tags:
//  *   name: Reels
//  *   description: Skill reel upload and retrieval
//  */

// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     Reel:
//  *       type: object
//  *       properties:
//  *         id:
//  *           type: integer
//  *           example: 1
//  *         videoUrl:
//  *           type: string
//  *           example: https://storage.googleapis.com/bucket/reels/index.m3u8
//  *         thumbnailUrl:
//  *           type: string
//  *           nullable: true
//  *           example: https://storage.googleapis.com/bucket/reels/thumb.jpg
//  *         title:
//  *           type: string
//  *           example: My Dribbling Reel
//  *         description:
//  *           type: string
//  *           nullable: true
//  *           example: Lagos trials 2026
//  *         published:
//  *           type: boolean
//  *           example: false
//  *         durationSec:
//  *           type: integer
//  *           nullable: true
//  *           example: 45
//  *         status:
//  *           type: string
//  *           enum: [processing, ready, failed]
//  *           example: ready
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           example: 2026-05-13T10:19:59.801Z
//  *         playerId:
//  *           type: integer
//  *           example: 7
//  *         categoryId:
//  *           type: integer
//  *           example: 7
//  *         category:
//  *           $ref: '#/components/schemas/VideoCategory'
//  *         averageRating:
//  *           type: number
//  *           nullable: true
//  *           example: 4.5
//  *         _count:
//  *           type: object
//  *           properties:
//  *             views:
//  *               type: integer
//  *               example: 120
//  *             comments:
//  *               type: integer
//  *               example: 8
//  *             ratings:
//  *               type: integer
//  *               example: 15
//  *
//  *     ReelDetail:
//  *       allOf:
//  *         - $ref: '#/components/schemas/Reel'
//  *         - type: object
//  *           properties:
//  *             player:
//  *               type: object
//  *               properties:
//  *                 id:
//  *                   type: integer
//  *                   example: 7
//  *                 fullname:
//  *                   type: string
//  *                   example: John Doe
//  *                 profile:
//  *                   type: object
//  *                   properties:
//  *                     avatarUrl:
//  *                       type: string
//  *                       nullable: true
//  *                     position:
//  *                       type: string
//  *                       nullable: true
//  *                       example: Forward
//  *                     country:
//  *                       type: string
//  *                       nullable: true
//  *                       example: Nigeria
//  *             comments:
//  *               type: array
//  *               items:
//  *                 type: object
//  *                 properties:
//  *                   id:
//  *                     type: integer
//  *                   text:
//  *                     type: string
//  *                   createdAt:
//  *                     type: string
//  *                     format: date-time
//  *                   user:
//  *                     type: object
//  *                     properties:
//  *                       id:
//  *                         type: integer
//  *                       fullname:
//  *                         type: string
//  *                       profile:
//  *                         type: object
//  *                         properties:
//  *                           avatarUrl:
//  *                             type: string
//  *                             nullable: true
//  *             ratings:
//  *               type: array
//  *               items:
//  *                 type: object
//  *                 properties:
//  *                   id:
//  *                     type: integer
//  *                   score:
//  *                     type: integer
//  *                     example: 5
//  *                   user:
//  *                     type: object
//  *                     properties:
//  *                       id:
//  *                         type: integer
//  *                       fullname:
//  *                         type: string
//  *
//  *     VideoCategory:
//  *       type: object
//  *       properties:
//  *         id:
//  *           type: integer
//  *           example: 7
//  *         title:
//  *           type: string
//  *           example: Dribbling
//  *         categoryType:
//  *           type: string
//  *           enum: [SKILL, GENERAL, TACTICAL, PHYSICAL]
//  *           example: SKILL
//  *
//  *     SuccessEnvelope:
//  *       type: object
//  *       properties:
//  *         success:
//  *           type: boolean
//  *           example: true
//  *         data:
//  *           type: object
//  *
//  *   responses:
//  *     BadRequest:
//  *       description: Bad request — invalid or missing parameters.
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               success:
//  *                 type: boolean
//  *                 example: false
//  *               message:
//  *                 type: string
//  *                 example: A valid categoryId is required.
//  *     Unauthorized:
//  *       description: Missing or invalid auth token.
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               success:
//  *                 type: boolean
//  *                 example: false
//  *               message:
//  *                 type: string
//  *                 example: Unauthorized.
//  *     Forbidden:
//  *       description: You do not have permission to perform this action.
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               success:
//  *                 type: boolean
//  *                 example: false
//  *               message:
//  *                 type: string
//  *                 example: Only players can upload reels.
//  *     NotFound:
//  *       description: Resource not found.
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               success:
//  *                 type: boolean
//  *                 example: false
//  *               message:
//  *                 type: string
//  *                 example: Reel not found.
//  *     ServerError:
//  *       description: Internal server error.
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               success:
//  *                 type: boolean
//  *                 example: false
//  *               message:
//  *                 type: string
//  *                 example: Internal server error.
//  */

// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /reels/upload:
//  *   post:
//  *     summary: Upload a skill reel
//  *     description: |
//  *       Uploads a skill reel video for the authenticated player.
//  *       A `categoryId` is **required** — reels must belong to a skill category
//  *       (e.g. Dribbling, Shooting, Agility, Speed).
//  *
//  *       The file is converted to HLS (`.m3u8` + `.ts` segments) via FFmpeg
//  *       and stored on Google Cloud Storage. The response is immediate (202)
//  *       and processing continues in the background — poll `GET /reels/:reelId`
//  *       to check when `status` becomes `ready`.
//  *     tags: [Reels]
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
//  *               - categoryId
//  *             properties:
//  *               video:
//  *                 type: string
//  *                 format: binary
//  *                 description: Video file (MP4 / MOV / AVI / WEBM). Max 500 MB.
//  *               thumbnail:
//  *                 type: string
//  *                 format: binary
//  *                 description: Optional thumbnail image (JPEG / PNG).
//  *               title:
//  *                 type: string
//  *                 example: My Dribbling Reel
//  *               description:
//  *                 type: string
//  *                 example: Lagos trials 2026
//  *               published:
//  *                 type: string
//  *                 enum: ['true', 'false']
//  *                 default: 'false'
//  *               categoryId:
//  *                 type: integer
//  *                 description: |
//  *                   Required. ID of the skill category this reel belongs to.
//  *                   Fetch available categories from GET /api/videoCategory.
//  *                 example: 7
//  *     responses:
//  *       202:
//  *         description: Reel received and processing in background.
//  *         content:
//  *           application/json:
//  *             schema:
//  *               allOf:
//  *                 - $ref: '#/components/schemas/SuccessEnvelope'
//  *                 - type: object
//  *                   properties:
//  *                     data:
//  *                       type: object
//  *                       properties:
//  *                         id:
//  *                           type: integer
//  *                           example: 1
//  *                         status:
//  *                           type: string
//  *                           example: processing
//  *                         title:
//  *                           type: string
//  *                           example: My Dribbling Reel
//  *       400:
//  *         $ref: '#/components/responses/BadRequest'
//  *       401:
//  *         $ref: '#/components/responses/Unauthorized'
//  *       403:
//  *         $ref: '#/components/responses/Forbidden'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// router.post('/upload', protect, handleUploadFields, handleReelUpload);

// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /reels:
//  *   get:
//  *     summary: Get all published reels filtered by category
//  *     description: |
//  *       Public endpoint. Returns all published reels belonging to a specific
//  *       category. Use `GET /api/videoCategory` first to get available category IDs,
//  *       then pass the chosen `categoryId` here.
//  *     tags: [Reels]
//  *     parameters:
//  *       - in: query
//  *         name: categoryId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *           example: 7
//  *         description: |
//  *           The category ID to filter reels by.
//  *           Get available IDs from GET /api/videoCategory.
//  *     responses:
//  *       200:
//  *         description: List of reels in the category.
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
//  *                         $ref: '#/components/schemas/Reel'
//  *       400:
//  *         $ref: '#/components/responses/BadRequest'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// router.get('/', handleGetReelsByCategory);

// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /users/{userId}/reels:
//  *   get:
//  *     summary: Get all reels for a player (optionally filtered by category)
//  *     description: |
//  *       Public endpoint. Returns every skill reel belonging to the player
//  *       identified by `userId`. Optionally filter by `categoryId` to get
//  *       only reels from a specific category for that player.
//  *     tags: [Reels]
//  *     parameters:
//  *       - in: path
//  *         name: userId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *           example: 7
//  *         description: The player's user ID.
//  *       - in: query
//  *         name: categoryId
//  *         required: false
//  *         schema:
//  *           type: integer
//  *           example: 7
//  *         description: |
//  *           Optional. Filter reels by category ID.
//  *           Get available IDs from GET /api/videoCategory.
//  *     responses:
//  *       200:
//  *         description: List of reels returned successfully.
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
//  *                         $ref: '#/components/schemas/Reel'
//  *       400:
//  *         $ref: '#/components/responses/BadRequest'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// router.get('/users/:userId/reels', handleGetUserReels);

// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /reels/{reelId}:
//  *   get:
//  *     summary: Get a single reel with full details
//  *     description: |
//  *       Public endpoint. Returns full reel details including the uploader's
//  *       profile, category (with `categoryType`), all comments, all ratings,
//  *       a computed `averageRating`, and aggregate counts.
//  *
//  *       **View tracking**: every call records a view.
//  *       - Authenticated requests are deduplicated per `userId`.
//  *       - Anonymous requests are deduplicated by hashed IP.
//  *     tags: [Reels]
//  *     security:
//  *       - {}
//  *       - BearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: reelId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *           example: 5
//  *         description: The reel's ID.
//  *     responses:
//  *       200:
//  *         description: Reel returned successfully.
//  *         content:
//  *           application/json:
//  *             schema:
//  *               allOf:
//  *                 - $ref: '#/components/schemas/SuccessEnvelope'
//  *                 - type: object
//  *                   properties:
//  *                     data:
//  *                       $ref: '#/components/schemas/ReelDetail'
//  *       400:
//  *         $ref: '#/components/responses/BadRequest'
//  *       404:
//  *         $ref: '#/components/responses/NotFound'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// router.get('/:reelId', protect, handleGetReel);

// export default router;

























// import { Router } from 'express';
// import { handleUploadFields } from '../config/multer.js';
// import {
//   handleReelUpload,
//   handleGetUserReels,
//   handleGetReel,
// } from '../controllers/reelController.js';
// import { verifyToken as protect } from '../middleware/auth.js';

// const router = Router();

// /**
//  * @swagger
//  * tags:
//  *   name: Reels
//  *   description: Skill reel upload and retrieval
//  */

// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /reels/upload:
//  *   post:
//  *     summary: Upload a skill reel
//  *     description: |
//  *       Uploads a skill reel video for the authenticated player.
//  *       A `categoryId` is **required** — reels must belong to a skill category
//  *       (e.g. Dribbling, Shooting, Agility, Speed).
//  *
//  *       The file is converted to HLS (`.m3u8` + `.ts` segments) via FFmpeg
//  *       and stored on Google Cloud Storage. The response is immediate (202)
//  *       and processing continues in the background — poll `GET /reels/:reelId`
//  *       to check when `status` becomes `ready`.
//  *     tags:
//  *       - Reels
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
//  *               - categoryId
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
//  *                 example: My Dribbling Reel
//  *               description:
//  *                 type: string
//  *                 example: Lagos trials 2026
//  *               published:
//  *                 type: string
//  *                 enum: ['true', 'false']
//  *                 default: 'false'
//  *                 description: Pass "true" to publish immediately.
//  *               categoryId:
//  *                 type: integer
//  *                 description: Required. ID of the skill category this reel belongs to.
//  *                 example: 3
//  *     responses:
//  *       202:
//  *         description: Reel received and processing in background.
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
//  *                   example: Reel received. Processing in background.
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     id:
//  *                       type: integer
//  *                       example: 1
//  *                     status:
//  *                       type: string
//  *                       example: processing
//  *                     title:
//  *                       type: string
//  *                       example: My Dribbling Reel
//  *       400:
//  *         $ref: '#/components/responses/BadRequest'
//  *       401:
//  *         $ref: '#/components/responses/Unauthorized'
//  *       403:
//  *         $ref: '#/components/responses/Forbidden'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// router.post('/upload', protect, handleUploadFields, handleReelUpload);

// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /users/{userId}/reels:
//  *   get:
//  *     summary: Get all reels for a player
//  *     description: |
//  *       Public endpoint. Returns every skill reel belonging to the player
//  *       identified by `userId`, each with its category (including `categoryType`),
//  *       comments, ratings, a computed `averageRating`, and aggregate counts.
//  *     tags:
//  *       - Reels
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
//  *         description: List of reels returned successfully.
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
//  *                         $ref: '#/components/schemas/Reel'
//  *       400:
//  *         $ref: '#/components/responses/BadRequest'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// router.get('/users/:userId/reels', handleGetUserReels);

// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /reels/{reelId}:
//  *   get:
//  *     summary: Get a single reel with reviews
//  *     description: |
//  *       Public endpoint. Returns full reel details including the uploader's
//  *       profile stub, category (with `categoryType`), all comments with
//  *       commenter avatars, all ratings, a computed `averageRating`, and
//  *       aggregate counts.
//  *
//  *       **View tracking**: every call records a view.
//  *       - Authenticated requests are deduplicated per `userId`.
//  *       - Anonymous requests are deduplicated by a hashed IP address.
//  *     tags:
//  *       - Reels
//  *     security:
//  *       - {}
//  *       - BearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: reelId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *           example: 5
//  *         description: The reel's ID.
//  *     responses:
//  *       200:
//  *         description: Reel returned successfully.
//  *         content:
//  *           application/json:
//  *             schema:
//  *               allOf:
//  *                 - $ref: '#/components/schemas/SuccessEnvelope'
//  *                 - type: object
//  *                   properties:
//  *                     data:
//  *                       $ref: '#/components/schemas/ReelDetail'
//  *       400:
//  *         $ref: '#/components/responses/BadRequest'
//  *       404:
//  *         $ref: '#/components/responses/NotFound'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// router.get('/:reelId', protect, handleGetReel);

// export default router;

// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *
//  *     Reel:
//  *       type: object
//  *       properties:
//  *         id:
//  *           type: integer
//  *           example: 1
//  *         videoUrl:
//  *           type: string
//  *           example: https://storage.googleapis.com/scouter_bucket/reels_7_.../index.m3u8
//  *         thumbnailUrl:
//  *           type: string
//  *           nullable: true
//  *           example: https://storage.googleapis.com/scouter_bucket/reels_7_.../thumb.jpg
//  *         title:
//  *           type: string
//  *           example: My Dribbling Reel
//  *         description:
//  *           type: string
//  *           nullable: true
//  *           example: Lagos trials 2026
//  *         published:
//  *           type: boolean
//  *           example: false
//  *         durationSec:
//  *           type: integer
//  *           nullable: true
//  *           example: 45
//  *         status:
//  *           type: string
//  *           example: ready
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           example: 2026-05-13T10:19:59.801Z
//  *         playerId:
//  *           type: integer
//  *           example: 7
//  *         category:
//  *           $ref: '#/components/schemas/VideoCategory'
//  *         averageRating:
//  *           type: number
//  *           nullable: true
//  *           example: 4.5
//  *         _count:
//  *           type: object
//  *           properties:
//  *             views:
//  *               type: integer
//  *               example: 120
//  *             comments:
//  *               type: integer
//  *               example: 8
//  *             ratings:
//  *               type: integer
//  *               example: 15
//  *
//  *     ReelDetail:
//  *       allOf:
//  *         - $ref: '#/components/schemas/Reel'
//  *         - type: object
//  *           properties:
//  *             player:
//  *               type: object
//  *               properties:
//  *                 id:
//  *                   type: integer
//  *                   example: 7
//  *                 fullname:
//  *                   type: string
//  *                   example: John Doe
//  *                 profile:
//  *                   type: object
//  *                   properties:
//  *                     avatarUrl:
//  *                       type: string
//  *                       nullable: true
//  *                     position:
//  *                       type: string
//  *                       nullable: true
//  *                       example: Forward
//  *                     country:
//  *                       type: string
//  *                       nullable: true
//  *                       example: Nigeria
//  *             comments:
//  *               type: array
//  *               items:
//  *                 type: object
//  *                 properties:
//  *                   id:
//  *                     type: integer
//  *                   text:
//  *                     type: string
//  *                   createdAt:
//  *                     type: string
//  *                     format: date-time
//  *                   user:
//  *                     type: object
//  *                     properties:
//  *                       id:
//  *                         type: integer
//  *                       fullname:
//  *                         type: string
//  *                       profile:
//  *                         type: object
//  *                         properties:
//  *                           avatarUrl:
//  *                             type: string
//  *                             nullable: true
//  *             ratings:
//  *               type: array
//  *               items:
//  *                 type: object
//  *                 properties:
//  *                   id:
//  *                     type: integer
//  *                   score:
//  *                     type: integer
//  *                     example: 5
//  *                   user:
//  *                     type: object
//  *                     properties:
//  *                       id:
//  *                         type: integer
//  *                       fullname:
//  *                         type: string
//  *
//  *   responses:
//  *     Forbidden:
//  *       description: You do not have permission to perform this action.
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               success:
//  *                 type: boolean
//  *                 example: false
//  *               message:
//  *                 type: string
//  *                 example: Only players can upload reels.
//  */