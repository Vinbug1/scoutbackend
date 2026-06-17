import { Router } from 'express';
import { handleUploadFields } from '../config/multer.js';
// reelRoutes.js
import reelController from '../controllers/reelController.js';

const {
  handleReelUpload,
  handleGetUserReels,
  handleGetReel,
  handleGetReelsByCategory,
} = reelController;


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



// // ─────────────────────────────────────────────────────────────────────────────
// // REPLY ROUTES — also mounted at /api/reels
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /api/reels/comments/{commentId}/replies:
//  *   get:
//  *     summary: Get paginated replies for a comment
//  *     description: >
//  *       **Trigger:** user taps "View X replies" under a comment.
//  *       Returns replies in ascending order (oldest first — threaded feel).
//  *     tags: [Replies]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: commentId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The parent comment ID
//  *       - in: query
//  *         name: page
//  *         schema:
//  *           type: integer
//  *           default: 1
//  *       - in: query
//  *         name: limit
//  *         schema:
//  *           type: integer
//  *           default: 10
//  *           maximum: 50
//  *     responses:
//  *       200:
//  *         description: Paginated reply list
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 replies:
//  *                   type: array
//  *                   items:
//  *                     $ref: '#/components/schemas/Reply'
//  *                 pagination:
//  *                   $ref: '#/components/schemas/Pagination'
//  *       401:
//  *         description: Unauthorized
//  *       404:
//  *         description: Comment not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/SuccessError'
//  *       500:
//  *         description: Server error
//  */
// router.get('/:commentId/replies', protect, replyController.getReplies);

// /**
//  * @swagger
//  * /api/reels/comments/{commentId}/replies:
//  *   post:
//  *     summary: Reply to a comment
//  *     description: >
//  *       **Trigger:** user taps the reply button on a comment, or taps on
//  *       a username mention like "@Vincent Williams" to reply to that person.
//  *       Pass `mentionedUser` (e.g. `"@Vincent Williams"`) and it will be
//  *       automatically prepended to the text if not already present.
//  *     tags: [Replies]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: commentId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required: [text]
//  *             properties:
//  *               text:
//  *                 type: string
//  *                 example: "Totally agree!"
//  *               mentionedUser:
//  *                 type: string
//  *                 example: "@Vincent Williams"
//  *                 description: >
//  *                   Display name of the user being replied to.
//  *                   Prepended to text if not already present.
//  *     responses:
//  *       201:
//  *         description: Reply posted
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 reply:
//  *                   $ref: '#/components/schemas/Reply'
//  *       400:
//  *         description: text is required
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/SuccessError'
//  *       401:
//  *         description: Unauthorized
//  *       404:
//  *         description: Comment not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/SuccessError'
//  *       500:
//  *         description: Server error
//  */
// router.post('/:commentId/replies', protect, replyController.createReply);

// /**
//  * @swagger
//  * /api/reels/replies/{replyId}:
//  *   delete:
//  *     summary: Delete your own reply
//  *     description: Only the reply owner can delete.
//  *     tags: [Replies]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: replyId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *     responses:
//  *       200:
//  *         description: Reply deleted
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
//  *                   example: "Reply deleted successfully"
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Not the reply owner
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/SuccessError'
//  *       404:
//  *         description: Reply not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/SuccessError'
//  *       500:
//  *         description: Server error
//  */
// router.delete('/replies/:replyId', protect, replyController.deleteReply);





export default router;






