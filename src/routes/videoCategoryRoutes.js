const express = require("express");
const { videoCategoryController } = require("./videoCategory.controller");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: VideoCategories
 *   description: Manage video categories
 */

/**
 * @swagger
 * /api/video-categories:
 *   post:
 *     summary: Create a new video category
 *     tags: [VideoCategories]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: Sports
 *     responses:
 *       201:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VideoCategory'
 *       400:
 *         description: Title is required
 *       500:
 *         description: Internal server error
 */
router.post("/", videoCategoryController.create);

/**
 * @swagger
 * /api/video-categories:
 *   get:
 *     summary: Retrieve all video categories
 *     tags: [VideoCategories]
 *     responses:
 *       200:
 *         description: List of all categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VideoCategoryWithCount'
 *       500:
 *         description: Internal server error
 */
router.get("/", videoCategoryController.findAll);

/**
 * @swagger
 * /api/video-categories/{id}:
 *   get:
 *     summary: Get a video category by ID (includes its published videos)
 *     tags: [VideoCategories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The category ID
 *     responses:
 *       200:
 *         description: Category found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VideoCategoryWithVideos'
 *       400:
 *         description: Invalid category ID
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", videoCategoryController.findById);

/**
 * @swagger
 * /api/video-categories/{id}:
 *   patch:
 *     summary: Update a video category title
 *     tags: [VideoCategories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: Entertainment
 *     responses:
 *       200:
 *         description: Category updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VideoCategory'
 *       400:
 *         description: Invalid ID or missing title
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id", videoCategoryController.update);

/**
 * @swagger
 * /api/video-categories/{id}:
 *   delete:
 *     summary: Delete a video category
 *     tags: [VideoCategories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The category ID
 *     responses:
 *       204:
 *         description: Category deleted successfully
 *       400:
 *         description: Invalid category ID
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", videoCategoryController.delete);

/**
 * @swagger
 * components:
 *   schemas:
 *     VideoCategory:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: Sports
 *
 *     VideoCategoryWithCount:
 *       allOf:
 *         - $ref: '#/components/schemas/VideoCategory'
 *         - type: object
 *           properties:
 *             _count:
 *               type: object
 *               properties:
 *                 videos:
 *                   type: integer
 *                   example: 12
 *
 *     VideoCategoryWithVideos:
 *       allOf:
 *         - $ref: '#/components/schemas/VideoCategoryWithCount'
 *         - type: object
 *           properties:
 *             videos:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   thumbnailUrl:
 *                     type: string
 *                     nullable: true
 *                   durationSec:
 *                     type: integer
 *                     nullable: true
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   status:
 *                     type: string
 *                     example: ready
 */

module.exports = router;