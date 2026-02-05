// routes/videoViewRoutes.js

import express from 'express';
import controller from '../controllers/videoViewController.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     VideoView:
 *       type: object
 *       required:
 *         - videoId
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated ID of the video view
 *         videoId:
 *           type: integer
 *           description: ID of the video being viewed
 *         userId:
 *           type: integer
 *           nullable: true
 *           description: ID of the user viewing (null for anonymous)
 *         ipHash:
 *           type: string
 *           nullable: true
 *           description: Hashed IP address for tracking anonymous views
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the view was recorded
 *       example:
 *         id: 1
 *         videoId: 42
 *         userId: 10
 *         ipHash: "a1b2c3d4e5f6"
 *         createdAt: "2025-11-28T10:30:00.000Z"
 *
 *     VideoViewInput:
 *       type: object
 *       required:
 *         - videoId
 *       properties:
 *         videoId:
 *           type: integer
 *           description: ID of the video being viewed
 *         userId:
 *           type: integer
 *           nullable: true
 *           description: ID of the user viewing (optional)
 *         ipHash:
 *           type: string
 *           nullable: true
 *           description: Hashed IP address (optional)
 *       example:
 *         videoId: 42
 *         userId: 10
 *         ipHash: "a1b2c3d4e5f6"
 *
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *         message:
 *           type: string
 *           description: Detailed error description
 */

/**
 * @swagger
 * tags:
 *   name: VideoViews
 *   description: Video view tracking and analytics
 */

/**
 * @swagger
 * /api/video-views:
 *   post:
 *     summary: Record a new video view
 *     tags: [VideoViews]
 *     description: Creates a new video view record. Enforces unique constraint on (videoId, userId) if user is logged in.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VideoViewInput'
 *     responses:
 *       201:
 *         description: Video view created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VideoView'
 *       400:
 *         description: User has already viewed this video (duplicate)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User has already viewed this video (unique constraint)"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', controller.createView);

/**
 * @swagger
 * /api/video-views:
 *   get:
 *     summary: Get all video views
 *     tags: [VideoViews]
 *     description: Retrieves all video view records with related video and user information
 *     responses:
 *       200:
 *         description: List of all video views
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VideoView'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', controller.getAllViews);

/**
 * @swagger
 * /api/video-views/{id}:
 *   get:
 *     summary: Get a video view by ID
 *     tags: [VideoViews]
 *     description: Retrieves a specific video view record with related video and user information
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Video view ID
 *     responses:
 *       200:
 *         description: Video view details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VideoView'
 *       404:
 *         description: Video view not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Video view not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', controller.getViewById);

/**
 * @swagger
 * /api/video-views/{id}:
 *   put:
 *     summary: Update a video view
 *     tags: [VideoViews]
 *     description: Updates an existing video view record (uncommon operation)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Video view ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VideoViewInput'
 *     responses:
 *       200:
 *         description: Video view updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VideoView'
 *       400:
 *         description: Duplicate view - user already viewed this video
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Duplicate view — this user already viewed this video"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', controller.updateView);

/**
 * @swagger
 * /api/video-views/{id}:
 *   delete:
 *     summary: Delete a video view
 *     tags: [VideoViews]
 *     description: Removes a video view record from the database
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Video view ID
 *     responses:
 *       200:
 *         description: Video view deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Video view deleted"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', controller.deleteView);

export default router;