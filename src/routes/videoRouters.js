import express from "express";
import videoController from "../controllers/videoController.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Video:
 *       type: object
 *       required:
 *         - videoUrl
 *         - title
 *         - playerId
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated video ID
 *         videoUrl:
 *           type: string
 *           description: URL of the video file
 *         thumbnailUrl:
 *           type: string
 *           description: URL of the video thumbnail
 *         title:
 *           type: string
 *           description: Video title
 *         description:
 *           type: string
 *           description: Video description
 *         published:
 *           type: boolean
 *           description: Publication status
 *           default: false
 *         durationSec:
 *           type: integer
 *           description: Video duration in seconds
 *         playerId:
 *           type: integer
 *           description: ID of the player who uploaded the video
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *       example:
 *         id: 1
 *         videoUrl: "https://example.com/videos/sample.mp4"
 *         thumbnailUrl: "https://example.com/thumbnails/sample.jpg"
 *         title: "Amazing Football Goal"
 *         description: "Watch this incredible goal from last night's match"
 *         published: true
 *         durationSec: 120
 *         playerId: 5
 *         createdAt: "2024-01-15T10:30:00Z"
 *         updatedAt: "2024-01-15T10:30:00Z"
 *
 *     VideoInput:
 *       type: object
 *       required:
 *         - videoUrl
 *         - title
 *         - playerId
 *       properties:
 *         videoUrl:
 *           type: string
 *         thumbnailUrl:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         published:
 *           type: boolean
 *         durationSec:
 *           type: integer
 *         playerId:
 *           type: integer
 *
 *     VideoUpdateInput:
 *       type: object
 *       properties:
 *         videoUrl:
 *           type: string
 *         thumbnailUrl:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         published:
 *           type: boolean
 *         durationSec:
 *           type: integer
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Server Error"
 *
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 */

/**
 * @swagger
 * /api/videos:
 *   post:
 *     summary: Create a new video
 *     tags: [Videos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VideoInput'
 *     responses:
 *       201:
 *         description: Video created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Video'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", videoController.createVideo);

/**
 * @swagger
 * /api/videos:
 *   get:
 *     summary: Get all videos with pagination and filters
 *     tags: [Videos]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: published
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by publication status
 *     responses:
 *       200:
 *         description: List of videos retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Video'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", videoController.getAllVideos);

/**
 * @swagger
 * /api/videos/{id}:
 *   get:
 *     summary: Get a single video by ID
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Video'
 *       404:
 *         description: Video not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Video not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:id", videoController.getVideoById);

/**
 * @swagger
 * /api/videos/{id}:
 *   put:
 *     summary: Update a video
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Video ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VideoUpdateInput'
 *     responses:
 *       200:
 *         description: Video updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Video'
 *       404:
 *         description: Video not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Video not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/:id", videoController.updateVideo);

/**
 * @swagger
 * /api/videos/{id}:
 *   delete:
 *     summary: Delete a video
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video deleted successfully
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
 *                   example: "Video deleted"
 *       404:
 *         description: Video not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Video not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:id", videoController.deleteVideo);

export default router;