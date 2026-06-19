// src/routes/commentRouter.js
import express from 'express';
import commentController     from '../controllers/commentController.js';


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
 *   - name: Comment & Reply Likes
 *     description: Like/unlike actions and counts for comments and replies.
 *   - name: Reel Likes
 *     description: Like/unlike actions and counts for reels.
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
 *         `_count.likes` tells the client the total likes on this comment.
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
 *             likes:
 *               type: integer
 *               example: 12
 *               description: Like count on this comment
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
 *         _count:
 *           type: object
 *           properties:
 *             likes:
 *               type: integer
 *               example: 3
 *               description: Like count on this reply
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
 *     LikeToggleResult:
 *       type: object
 *       properties:
 *         liked:
 *           type: boolean
 *           example: true
 *           description: true = just liked, false = just unliked
 *         likesCount:
 *           type: integer
 *           example: 18
 *
 *     CommentLikeInfo:
 *       type: object
 *       properties:
 *         commentId:
 *           type: integer
 *           example: 42
 *         likesCount:
 *           type: integer
 *           example: 12
 *         likedByMe:
 *           type: boolean
 *           example: true
 *
 *     ReplyLikeInfo:
 *       type: object
 *       properties:
 *         replyId:
 *           type: integer
 *           example: 99
 *         likesCount:
 *           type: integer
 *           example: 3
 *         likedByMe:
 *           type: boolean
 *           example: false
 *
 *     ReelLikeInfo:
 *       type: object
 *       properties:
 *         reelId:
 *           type: integer
 *           example: 7
 *         likesCount:
 *           type: integer
 *           example: 104
 *         likedByMe:
 *           type: boolean
 *           example: true
 *
 *     ReelLikeCount:
 *       type: object
 *       properties:
 *         reelId:
 *           type: integer
 *           example: 7
 *         likesCount:
 *           type: integer
 *           example: 104
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
// GENERAL COMMENT ROUTES — mounted at /api/comments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route  POST /api/comments
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
 *       500:
 *         description: Server error
 */
router.post('/', commentController.createComment);

/**
 * @route  GET /api/comments
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
 * @route  GET /api/comments/:id
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
 * @route  PUT /api/comments/:id
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
 * @route  DELETE /api/comments/:id
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


export default router;

