import { Router } from 'express';
import { create, findAll, findById, update, remove } from '../controllers/videoCategoryController.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: VideoCategories
 *   description: Manage video categories
 */

/**
 * @swagger
 * /api/videoCategory:
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
 *                 example: Dribbling
 *               categoryType:
 *                 type: string
 *                 enum: [SKILL, GENERAL]
 *                 default: GENERAL
 *                 example: SKILL
 *     responses:
 *       201:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VideoCategory'
 *       400:
 *         description: Title is required or invalid categoryType
 *       500:
 *         description: Internal server error
 */
router.post('/', create);

/**
 * @swagger
 * /api/videoCategory:
 *   get:
 *     summary: Retrieve all video categories (optionally filter by categoryType)
 *     tags: [VideoCategories]
 *     parameters:
 *       - in: query
 *         name: categoryType
 *         schema:
 *           type: string
 *           enum: [SKILL, GENERAL]
 *         required: false
 *         description: Filter categories by type
 *     responses:
 *       200:
 *         description: List of all categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VideoCategoryWithCount'
 *       400:
 *         description: Invalid categoryType
 *       500:
 *         description: Internal server error
 */
router.get('/', findAll);

/**
 * @swagger
 * /api/videoCategory/{id}:
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
router.get('/:id', findById);

/**
 * @swagger
 * /api/videoCategory/{id}:
 *   patch:
 *     summary: Update a video category title and/or categoryType
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
 *             properties:
 *               title:
 *                 type: string
 *                 example: Shooting
 *               categoryType:
 *                 type: string
 *                 enum: [SKILL, GENERAL]
 *                 example: SKILL
 *     responses:
 *       200:
 *         description: Category updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VideoCategory'
 *       400:
 *         description: Invalid ID, missing fields, or invalid categoryType
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
 */
router.patch('/:id', update);

/**
 * @swagger
 * /api/videoCategory/{id}:
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
router.delete('/:id', remove);

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
 *           example: Dribbling
 *         categoryType:
 *           type: string
 *           enum: [SKILL, GENERAL]
 *           example: SKILL
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

export default router;








