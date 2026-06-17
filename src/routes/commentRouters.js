// src/routes/commentRouter.js
import express from 'express';
import commentController from '../controllers/commentController.js';
import replyController   from '../controllers/replyController.js';
import { verifyToken as protect } from '../middleware/auth.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// SWAGGER — Tags
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   - name: Comments
 *     description: General comment management (posts, videos, reels)
 *   - name: Reel Comments
 *     description: >
 *       Lazy-loaded comments for reels.
 *       Fetched on comment icon click — never embedded in reel feed data.
 *   - name: Replies
 *     description: >
 *       Lazy-loaded replies for a comment.
 *       Fetched when user taps "View X replies" — never embedded in comment data.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SWAGGER — Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *
 *   schemas:
 *
 *     Author:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 7
 *         fullname:
 *           type: string
 *           example: "Vincent Williams"
 *         profile:
 *           type: object
 *           nullable: true
 *           properties:
 *             avatarUrl:
 *               type: string
 *               nullable: true
 *               example: "https://cdn.example.com/avatars/7.jpg"
 *
 *     ReelComment:
 *       type: object
 *       description: >
 *         Comment returned for reel comment feeds.
 *         `_count.replies` tells the client how many replies exist
 *         so it can render "View X replies" without fetching them.
 *       properties:
 *         id:
 *           type: integer
 *           example: 42
 *         text:
 *           type: string
 *           example: "Incredible footwork!"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: ISO timestamp — use on client for "1h ago" display
 *         user:
 *           $ref: '#/components/schemas/Author'
 *         _count:
 *           type: object
 *           properties:
 *             replies:
 *               type: integer
 *               example: 4
 *               description: Reply count only — no reply data fetched
 *
 *     Reply:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 99
 *         text:
 *           type: string
 *           example: "@Vincent Williams Great point!"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: ISO timestamp — use on client for "1h ago" display
 *         user:
 *           $ref: '#/components/schemas/Author'
 *
 *     Comment:
 *       type: object
 *       description: General comment shape (used by CRUD endpoints)
 *       properties:
 *         id:
 *           type: integer
 *         text:
 *           type: string
 *         userId:
 *           type: integer
 *         postId:
 *           type: integer
 *           nullable: true
 *         videoId:
 *           type: integer
 *           nullable: true
 *         reelId:
 *           type: integer
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: 1
 *         text: "Great skills!"
 *         userId: 5
 *         reelId: 3
 *         postId: null
 *         videoId: null
 *         createdAt: "2024-01-15T10:30:00.000Z"
 *
 *     CommentInput:
 *       type: object
 *       required: [text, userId]
 *       properties:
 *         text:
 *           type: string
 *         userId:
 *           type: integer
 *         postId:
 *           type: integer
 *         videoId:
 *           type: integer
 *         reelId:
 *           type: integer
 *       example:
 *         text: "Great skills!"
 *         userId: 5
 *         reelId: 3
 *
 *     CommentUpdate:
 *       type: object
 *       required: [text]
 *       properties:
 *         text:
 *           type: string
 *       example:
 *         text: "Updated comment text"
 *
 *     Pagination:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           example: 42
 *         page:
 *           type: integer
 *           example: 1
 *         limit:
 *           type: integer
 *           example: 20
 *         totalPages:
 *           type: integer
 *           example: 3
 *
 *     Error:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *       example:
 *         message: "Comment not found"
 *
 *     SuccessError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *       example:
 *         success: false
 *         message: "Comment not found"
 */

// ─────────────────────────────────────────────────────────────────────────────
// GENERAL COMMENT ROUTES  — mounted at /api/comments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Create a comment on a post, video, or reel
 *     tags: [Comments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentInput'
 *     responses:
 *       201:
 *         description: Comment created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Missing fields or invalid reference
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
router.post('/', commentController.createComment);

/**
 * @swagger
 * /api/comments:
 *   get:
 *     summary: Get comments with optional filters
 *     tags: [Comments]
 *     parameters:
 *       - in: query
 *         name: postId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: videoId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: reelId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 *       500:
 *         description: Server error
 */
router.get('/', commentController.getComments);

/**
 * @swagger
 * /api/comments/{id}:
 *   get:
 *     summary: Get a single comment by ID
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Comment found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Server error
 */
router.get('/:id', commentController.getCommentById);

/**
 * @swagger
 * /api/comments/{id}:
 *   put:
 *     summary: Update a comment
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentUpdate'
 *     responses:
 *       200:
 *         description: Comment updated
 *       400:
 *         description: text is required
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Server error
 */
router.put('/:id', commentController.updateComment);

/**
 * @swagger
 * /api/comments/{id}:
 *   delete:
 *     summary: Delete a comment
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *               example:
 *                 message: "Comment deleted successfully"
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', commentController.deleteComment);

// ─────────────────────────────────────────────────────────────────────────────
// REEL COMMENT ROUTES — mounted at /api/reels  (see app.js)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/reels/{reelId}/comments:
 *   get:
 *     summary: Get paginated comments for a reel
 *     description: >
 *       **Trigger:** user taps the comment icon on a reel.
 *       Returns top-level comments only. Each comment includes `_count.replies`
 *       so the client can render "View X replies" without fetching reply data.
 *     tags: [Reel Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reelId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Paginated comment list (no replies embedded)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 comments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ReelComment'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Reel not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessError'
 *       500:
 *         description: Server error
 */
router.get('/:reelId/comments', protect, commentController.getReelComments);

/**
 * @swagger
 * /api/reels/{reelId}/comments:
 *   post:
 *     summary: Post a comment on a reel
 *     tags: [Reel Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reelId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 example: "Incredible footwork!"
 *     responses:
 *       201:
 *         description: Comment posted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 comment:
 *                   $ref: '#/components/schemas/ReelComment'
 *       400:
 *         description: text is required or reel not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessError'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/:reelId/comments', protect, commentController.addReelComment);

/**
 * @swagger
 * /api/reels/comments/{commentId}:
 *   delete:
 *     summary: Delete your own comment from a reel
 *     description: Only the comment owner can delete. Cascades to all replies via DB.
 *     tags: [Reel Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Comment (and all its replies) deleted
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
 *                   example: "Comment deleted successfully"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the comment owner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessError'
 *       404:
 *         description: Comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessError'
 *       500:
 *         description: Server error
 */
router.delete('/comments/:commentId', protect, commentController.deleteReelComment);

// ─────────────────────────────────────────────────────────────────────────────
// REPLY ROUTES — also mounted at /api/reels
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/reels/comments/{commentId}/replies:
 *   get:
 *     summary: Get paginated replies for a comment
 *     description: >
 *       **Trigger:** user taps "View X replies" under a comment.
 *       Returns replies in ascending order (oldest first — threaded feel).
 *     tags: [Replies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The parent comment ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Paginated reply list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 replies:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Reply'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessError'
 *       500:
 *         description: Server error
 */
router.get('/comments/:commentId/replies', protect, replyController.getReplies);

/**
 * @swagger
 * /api/reels/comments/{commentId}/replies:
 *   post:
 *     summary: Reply to a comment
 *     description: >
 *       **Trigger:** user taps the reply button on a comment, or taps on
 *       a username mention like "@Vincent Williams" to reply to that person.
 *       Pass `mentionedUser` (e.g. `"@Vincent Williams"`) and it will be
 *       automatically prepended to the text if not already present.
 *     tags: [Replies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 example: "Totally agree!"
 *               mentionedUser:
 *                 type: string
 *                 example: "@Vincent Williams"
 *                 description: >
 *                   Display name of the user being replied to.
 *                   Prepended to text if not already present.
 *     responses:
 *       201:
 *         description: Reply posted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 reply:
 *                   $ref: '#/components/schemas/Reply'
 *       400:
 *         description: text is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessError'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessError'
 *       500:
 *         description: Server error
 */
router.post('/comments/:commentId/replies', protect, replyController.createReply);

/**
 * @swagger
 * /api/reels/replies/{replyId}:
 *   delete:
 *     summary: Delete your own reply
 *     description: Only the reply owner can delete.
 *     tags: [Replies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: replyId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reply deleted
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
 *                   example: "Reply deleted successfully"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the reply owner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessError'
 *       404:
 *         description: Reply not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessError'
 *       500:
 *         description: Server error
 */
router.delete('/replies/:replyId', protect, replyController.deleteReply);

export default router;










// import express from 'express';
// import commentController from '../controllers/commentController.js';
// import replyController from '../controllers/replyController.js';
// import { verifyToken as protect } from '../middleware/auth.js'; // adjust path as needed

// const router = express.Router();

// // ─────────────────────────────────────────────────────────────────────────────
// // SWAGGER COMPONENT SCHEMAS
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     Comment:
//  *       type: object
//  *       required:
//  *         - text
//  *         - userId
//  *       properties:
//  *         id:
//  *           type: integer
//  *           description: The auto-generated id of the comment
//  *         text:
//  *           type: string
//  *           description: The comment text content
//  *         userId:
//  *           type: integer
//  *           description: The ID of the user who created the comment
//  *         postId:
//  *           type: integer
//  *           nullable: true
//  *           description: The ID of the post (if comment is on a post)
//  *         videoId:
//  *           type: integer
//  *           nullable: true
//  *           description: The ID of the video (if comment is on a video)
//  *         reelId:
//  *           type: integer
//  *           nullable: true
//  *           description: The ID of the reel (if comment is on a reel)
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           description: The date the comment was created (used for "1h ago" display)
//  *         updatedAt:
//  *           type: string
//  *           format: date-time
//  *           description: The date the comment was last updated
//  *       example:
//  *         id: 1
//  *         text: "Great skills!"
//  *         userId: 5
//  *         reelId: 3
//  *         postId: null
//  *         videoId: null
//  *         createdAt: "2024-01-15T10:30:00.000Z"
//  *
//  *     CommentInput:
//  *       type: object
//  *       required:
//  *         - text
//  *         - userId
//  *       properties:
//  *         text:
//  *           type: string
//  *           description: The comment text content
//  *         userId:
//  *           type: integer
//  *           description: The ID of the user creating the comment
//  *         postId:
//  *           type: integer
//  *           description: The ID of the post (required if videoId/reelId not provided)
//  *         videoId:
//  *           type: integer
//  *           description: The ID of the video (required if postId/reelId not provided)
//  *         reelId:
//  *           type: integer
//  *           description: The ID of the reel (required if postId/videoId not provided)
//  *       example:
//  *         text: "Great skills!"
//  *         userId: 5
//  *         reelId: 3
//  *
//  *     CommentUpdate:
//  *       type: object
//  *       required:
//  *         - text
//  *       properties:
//  *         text:
//  *           type: string
//  *           description: The updated comment text
//  *       example:
//  *         text: "Updated comment text"
//  *
//  *     ReelComment:
//  *       type: object
//  *       description: Lightweight comment shape returned for reel comment feeds
//  *       properties:
//  *         id:
//  *           type: integer
//  *         text:
//  *           type: string
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           description: ISO timestamp — use on client for "1h ago" formatting
//  *         user:
//  *           type: object
//  *           properties:
//  *             id:
//  *               type: integer
//  *             fullname:
//  *               type: string
//  *             profile:
//  *               type: object
//  *               properties:
//  *                 avatarUrl:
//  *                   type: string
//  *                   nullable: true
//  *         _count:
//  *           type: object
//  *           properties:
//  *             replies:
//  *               type: integer
//  *               description: Number of replies on this comment (no reply data fetched)
//  *       example:
//  *         id: 12
//  *         text: "Incredible footwork!"
//  *         createdAt: "2024-06-01T08:00:00.000Z"
//  *         user:
//  *           id: 5
//  *           fullname: "John Doe"
//  *           profile:
//  *             avatarUrl: "https://cdn.example.com/avatar.jpg"
//  *         _count:
//  *           replies: 4
//  *
//  *     Reply:
//  *       type: object
//  *       properties:
//  *         id:
//  *           type: integer
//  *         text:
//  *           type: string
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           description: ISO timestamp — use on client for "1h ago" formatting
//  *         user:
//  *           type: object
//  *           properties:
//  *             id:
//  *               type: integer
//  *             fullname:
//  *               type: string
//  *             profile:
//  *               type: object
//  *               properties:
//  *                 avatarUrl:
//  *                   type: string
//  *                   nullable: true
//  *       example:
//  *         id: 7
//  *         text: "Agreed, top player!"
//  *         createdAt: "2024-06-01T09:15:00.000Z"
//  *         user:
//  *           id: 9
//  *           fullname: "Jane Smith"
//  *           profile:
//  *             avatarUrl: "https://cdn.example.com/jane.jpg"
//  *
//  *     Pagination:
//  *       type: object
//  *       properties:
//  *         total:
//  *           type: integer
//  *         page:
//  *           type: integer
//  *         limit:
//  *           type: integer
//  *         totalPages:
//  *           type: integer
//  *       example:
//  *         total: 42
//  *         page: 1
//  *         limit: 20
//  *         totalPages: 3
//  *
//  *     Error:
//  *       type: object
//  *       properties:
//  *         message:
//  *           type: string
//  *       example:
//  *         message: "Failed to create comment"
//  */

// // ─────────────────────────────────────────────────────────────────────────────
// // TAGS
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * tags:
//  *   - name: Comments
//  *     description: General comment management (posts, videos, reels)
//  *   - name: Reel Comments
//  *     description: Lazy-loaded comments for reels — fetched on comment icon click
//  *   - name: Replies
//  *     description: Lazy-loaded replies for comments — fetched on "View replies" tap
//  */

// // ─────────────────────────────────────────────────────────────────────────────
// // GENERAL COMMENT ROUTES  /api/comments
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /api/comments:
//  *   post:
//  *     summary: Create a new comment
//  *     tags: [Comments]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/CommentInput'
//  *     responses:
//  *       201:
//  *         description: Comment created successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Comment'
//  *       400:
//  *         description: Missing required fields or invalid references
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.post('/', commentController.createComment);

// /**
//  * @swagger
//  * /api/comments:
//  *   get:
//  *     summary: Get all comments with optional filters
//  *     tags: [Comments]
//  *     parameters:
//  *       - in: query
//  *         name: postId
//  *         schema:
//  *           type: integer
//  *         description: Filter comments by post ID
//  *       - in: query
//  *         name: videoId
//  *         schema:
//  *           type: integer
//  *         description: Filter comments by video ID
//  *       - in: query
//  *         name: reelId
//  *         schema:
//  *           type: integer
//  *         description: Filter comments by reel ID
//  *     responses:
//  *       200:
//  *         description: List of comments retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items:
//  *                 $ref: '#/components/schemas/Comment'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/', commentController.getComments);

// /**
//  * @swagger
//  * /api/comments/{id}:
//  *   get:
//  *     summary: Get a single comment by ID
//  *     tags: [Comments]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The comment ID
//  *     responses:
//  *       200:
//  *         description: Comment retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Comment'
//  *       404:
//  *         description: Comment not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/:id', commentController.getCommentById);

// /**
//  * @swagger
//  * /api/comments/{id}:
//  *   put:
//  *     summary: Update a comment
//  *     tags: [Comments]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The comment ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/CommentUpdate'
//  *     responses:
//  *       200:
//  *         description: Comment updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Comment'
//  *       400:
//  *         description: text is required
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       404:
//  *         description: Comment not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.put('/:id', commentController.updateComment);

// /**
//  * @swagger
//  * /api/comments/{id}:
//  *   delete:
//  *     summary: Delete a comment
//  *     tags: [Comments]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The comment ID
//  *     responses:
//  *       200:
//  *         description: Comment deleted successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *               example:
//  *                 message: "Comment deleted successfully"
//  *       404:
//  *         description: Comment not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.delete('/:id', commentController.deleteComment);

// // ─────────────────────────────────────────────────────────────────────────────
// // REEL COMMENT ROUTES  /api/reels/:reelId/comments
// // Mounted separately — see app.js: app.use('/api/reels', commentRouter)
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /api/reels/{reelId}/comments:
//  *   get:
//  *     summary: Get paginated comments for a reel
//  *     description: >
//  *       Called on comment icon click. Returns lightweight comment objects with
//  *       `createdAt` for "1h ago" formatting. Replies are NOT included —
//  *       they are fetched separately when the user taps "View replies".
//  *     tags: [Reel Comments]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: reelId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The reel ID
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
//  *           maximum: 50
//  *         description: Number of comments per page (max 50)
//  *     responses:
//  *       200:
//  *         description: Paginated comment list
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 comments:
//  *                   type: array
//  *                   items:
//  *                     $ref: '#/components/schemas/ReelComment'
//  *                 pagination:
//  *                   $ref: '#/components/schemas/Pagination'
//  *       400:
//  *         description: Invalid reel ID
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       401:
//  *         description: Unauthorized
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/:reelId/comments', protect, commentController.getReelComments);

// /**
//  * @swagger
//  * /api/reels/{reelId}/comments:
//  *   post:
//  *     summary: Post a comment on a reel
//  *     tags: [Reel Comments]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: reelId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The reel ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - text
//  *             properties:
//  *               text:
//  *                 type: string
//  *                 description: Comment text
//  *             example:
//  *               text: "Incredible footwork!"
//  *     responses:
//  *       201:
//  *         description: Comment posted successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 comment:
//  *                   $ref: '#/components/schemas/ReelComment'
//  *       400:
//  *         description: text is required or reel not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       401:
//  *         description: Unauthorized
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.post('/:reelId/comments', protect, commentController.addReelComment);

// /**
//  * @swagger
//  * /api/reels/comments/{commentId}:
//  *   delete:
//  *     summary: Delete a comment on a reel
//  *     description: Only the comment owner can delete their comment.
//  *     tags: [Reel Comments]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: commentId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The comment ID to delete
//  *     responses:
//  *       200:
//  *         description: Comment deleted successfully
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
//  *                   example: "Comment deleted successfully"
//  *       401:
//  *         description: Unauthorized
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       403:
//  *         description: Forbidden — not the comment owner
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       404:
//  *         description: Comment not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.delete('/comments/:commentId', protect, commentController.deleteComment);

// // ─────────────────────────────────────────────────────────────────────────────
// // REPLY ROUTES  /api/reels/comments/:commentId/replies
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * @swagger
//  * /api/reels/comments/{commentId}/replies:
//  *   get:
//  *     summary: Get paginated replies for a comment
//  *     description: >
//  *       Called when the user taps "View X replies" under a comment.
//  *       Returns replies in ascending order (oldest first) with `createdAt`
//  *       for "1h ago" formatting.
//  *     tags: [Replies]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: commentId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The comment ID
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
//  *           default: 10
//  *           maximum: 50
//  *         description: Number of replies per page (max 50)
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
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       404:
//  *         description: Comment not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/comments/:commentId/replies', protect, replyController.getReplies);

// /**
//  * @swagger
//  * /api/reels/comments/{commentId}/replies:
//  *   post:
//  *     summary: Post a reply to a comment
//  *     tags: [Replies]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: commentId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The comment ID to reply to
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - text
//  *             properties:
//  *               text:
//  *                 type: string
//  *                 description: Reply text
//  *             example:
//  *               text: "Agreed, top player!"
//  *     responses:
//  *       201:
//  *         description: Reply posted successfully
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
//  *               $ref: '#/components/schemas/Error'
//  *       401:
//  *         description: Unauthorized
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       404:
//  *         description: Comment not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.post('/comments/:commentId/replies', protect, replyController.createReply);

// /**
//  * @swagger
//  * /api/reels/replies/{replyId}:
//  *   delete:
//  *     summary: Delete a reply
//  *     description: Only the reply owner can delete their reply.
//  *     tags: [Replies]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: replyId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: The reply ID to delete
//  *     responses:
//  *       200:
//  *         description: Reply deleted successfully
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
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       403:
//  *         description: Forbidden — not the reply owner
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       404:
//  *         description: Reply not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.delete('/replies/:replyId', protect, replyController.deleteReply);

// export default router;

















// import express from 'express';
// const router = express.Router();
// import commentController from '../controllers/commentController.js';

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     Comment:
//  *       type: object
//  *       required:
//  *         - text
//  *         - userId
//  *       properties:
//  *         id:
//  *           type: integer
//  *           description: The auto-generated id of the comment
//  *         text:
//  *           type: string
//  *           description: The comment text content
//  *         userId:
//  *           type: integer
//  *           description: The ID of the user who created the comment
//  *         postId:
//  *           type: integer
//  *           nullable: true
//  *           description: The ID of the post (if comment is on a post)
//  *         videoId:
//  *           type: integer
//  *           nullable: true
//  *           description: The ID of the video (if comment is on a video)
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           description: The date the comment was created
//  *         updatedAt:
//  *           type: string
//  *           format: date-time
//  *           description: The date the comment was last updated
//  *       example:
//  *         id: 1
//  *         text: "This is a great post!"
//  *         userId: 5
//  *         postId: 10
//  *         videoId: null
//  *         createdAt: "2024-01-15T10:30:00.000Z"
//  *         updatedAt: "2024-01-15T10:30:00.000Z"
//  *     
//  *     CommentInput:
//  *       type: object
//  *       required:
//  *         - text
//  *         - userId
//  *       properties:
//  *         text:
//  *           type: string
//  *           description: The comment text content
//  *         userId:
//  *           type: integer
//  *           description: The ID of the user creating the comment
//  *         postId:
//  *           type: integer
//  *           description: The ID of the post (required if videoId is not provided)
//  *         videoId:
//  *           type: integer
//  *           description: The ID of the video (required if postId is not provided)
//  *       example:
//  *         text: "This is a great post!"
//  *         userId: 5
//  *         postId: 10
//  *     
//  *     CommentUpdate:
//  *       type: object
//  *       required:
//  *         - text
//  *       properties:
//  *         text:
//  *           type: string
//  *           description: The updated comment text
//  *       example:
//  *         text: "This is an updated comment!"
//  *     
//  *     Error:
//  *       type: object
//  *       properties:
//  *         message:
//  *           type: string
//  *           description: Error message
//  *       example:
//  *         message: "Failed to create comment"
//  */

// /**
//  * @swagger
//  * tags:
//  *   name: Comments
//  *   description: Comment management API
//  */

// /**
//  * @swagger
//  * /api/comments:
//  *   post:
//  *     summary: Create a new comment
//  *     tags: [Comments]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/CommentInput'
//  *     responses:
//  *       201:
//  *         description: Comment created successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Comment'
//  *       400:
//  *         description: Bad request - missing required fields
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.post('/', commentController.createComment);

// /**
//  * @swagger
//  * /api/comments:
//  *   get:
//  *     summary: Get all comments with optional filters
//  *     tags: [Comments]
//  *     parameters:
//  *       - in: query
//  *         name: postId
//  *         schema:
//  *           type: integer
//  *         description: Filter comments by post ID
//  *       - in: query
//  *         name: videoId
//  *         schema:
//  *           type: integer
//  *         description: Filter comments by video ID
//  *     responses:
//  *       200:
//  *         description: List of comments retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items:
//  *                 $ref: '#/components/schemas/Comment'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/', commentController.getComments);

// /**
//  * @swagger
//  * /api/comments/{id}:
//  *   get:
//  *     summary: Get a comment by ID
//  *     tags: [Comments]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         schema:
//  *           type: integer
//  *         required: true
//  *         description: The comment ID
//  *     responses:
//  *       200:
//  *         description: Comment retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Comment'
//  *       404:
//  *         description: Comment not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get('/:id', commentController.getCommentById);

// /**
//  * @swagger
//  * /api/comments/{id}:
//  *   put:
//  *     summary: Update a comment
//  *     tags: [Comments]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         schema:
//  *           type: integer
//  *         required: true
//  *         description: The comment ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/CommentUpdate'
//  *     responses:
//  *       200:
//  *         description: Comment updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Comment'
//  *       400:
//  *         description: Bad request - text is required
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       404:
//  *         description: Comment not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.put('/:id', commentController.updateComment);

// /**
//  * @swagger
//  * /api/comments/{id}:
//  *   delete:
//  *     summary: Delete a comment
//  *     tags: [Comments]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         schema:
//  *           type: integer
//  *         required: true
//  *         description: The comment ID
//  *     responses:
//  *       200:
//  *         description: Comment deleted successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *               example:
//  *                 message: "Comment deleted successfully"
//  *       404:
//  *         description: Comment not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Internal server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.delete('/:id', commentController.deleteComment);

// export default router;