import express from 'express';
const router = express.Router();
import commentController from '../controllers/commentController.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Comment:
 *       type: object
 *       required:
 *         - text
 *         - userId
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the comment
 *         text:
 *           type: string
 *           description: The comment text content
 *         userId:
 *           type: integer
 *           description: The ID of the user who created the comment
 *         postId:
 *           type: integer
 *           nullable: true
 *           description: The ID of the post (if comment is on a post)
 *         videoId:
 *           type: integer
 *           nullable: true
 *           description: The ID of the video (if comment is on a video)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the comment was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the comment was last updated
 *       example:
 *         id: 1
 *         text: "This is a great post!"
 *         userId: 5
 *         postId: 10
 *         videoId: null
 *         createdAt: "2024-01-15T10:30:00.000Z"
 *         updatedAt: "2024-01-15T10:30:00.000Z"
 *     
 *     CommentInput:
 *       type: object
 *       required:
 *         - text
 *         - userId
 *       properties:
 *         text:
 *           type: string
 *           description: The comment text content
 *         userId:
 *           type: integer
 *           description: The ID of the user creating the comment
 *         postId:
 *           type: integer
 *           description: The ID of the post (required if videoId is not provided)
 *         videoId:
 *           type: integer
 *           description: The ID of the video (required if postId is not provided)
 *       example:
 *         text: "This is a great post!"
 *         userId: 5
 *         postId: 10
 *     
 *     CommentUpdate:
 *       type: object
 *       required:
 *         - text
 *       properties:
 *         text:
 *           type: string
 *           description: The updated comment text
 *       example:
 *         text: "This is an updated comment!"
 *     
 *     Error:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Error message
 *       example:
 *         message: "Failed to create comment"
 */

/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: Comment management API
 */

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Create a new comment
 *     tags: [Comments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentInput'
 *     responses:
 *       201:
 *         description: Comment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', commentController.createComment);

/**
 * @swagger
 * /api/comments:
 *   get:
 *     summary: Get all comments with optional filters
 *     tags: [Comments]
 *     parameters:
 *       - in: query
 *         name: postId
 *         schema:
 *           type: integer
 *         description: Filter comments by post ID
 *       - in: query
 *         name: videoId
 *         schema:
 *           type: integer
 *         description: Filter comments by video ID
 *     responses:
 *       200:
 *         description: List of comments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', commentController.getComments);

/**
 * @swagger
 * /api/comments/{id}:
 *   get:
 *     summary: Get a comment by ID
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The comment ID
 *     responses:
 *       200:
 *         description: Comment retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       404:
 *         description: Comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *         schema:
 *           type: integer
 *         required: true
 *         description: The comment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentUpdate'
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Bad request - text is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *         schema:
 *           type: integer
 *         required: true
 *         description: The comment ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', commentController.deleteComment);

export default router;