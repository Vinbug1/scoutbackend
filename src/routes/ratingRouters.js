import express from 'express';
const router = express.Router();
import ratingController from '../controllers/ratingController.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Rating:
 *       type: object
 *       required:
 *         - score
 *         - videoId
 *         - userId
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the rating
 *         score:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           description: Rating score (1-5)
 *         videoId:
 *           type: integer
 *           description: The ID of the video being rated
 *         userId:
 *           type: integer
 *           description: The ID of the user giving the rating
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the rating was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the rating was last updated
 *       example:
 *         id: 1
 *         score: 5
 *         videoId: 10
 *         userId: 5
 *         createdAt: 2024-01-01T00:00:00.000Z
 *         updatedAt: 2024-01-01T00:00:00.000Z
 *     RatingInput:
 *       type: object
 *       required:
 *         - score
 *         - videoId
 *         - userId
 *       properties:
 *         score:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           description: Rating score (1-5)
 *         videoId:
 *           type: integer
 *           description: The ID of the video being rated
 *         userId:
 *           type: integer
 *           description: The ID of the user giving the rating
 *       example:
 *         score: 5
 *         videoId: 10
 *         userId: 5
 *     RatingUpdate:
 *       type: object
 *       required:
 *         - score
 *       properties:
 *         score:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           description: Updated rating score (1-5)
 *       example:
 *         score: 4
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *     Success:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Success message
 */

/**
 * @swagger
 * tags:
 *   name: Ratings
 *   description: Video rating management API
 */

/**
 * @swagger
 * /api/ratings:
 *   post:
 *     summary: Create a new rating
 *     tags: [Ratings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RatingInput'
 *     responses:
 *       201:
 *         description: Rating created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Rating'
 *       400:
 *         description: Invalid score or user already rated this video
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalidScore:
 *                 value:
 *                   error: "Score must be between 1 and 5"
 *               duplicateRating:
 *                 value:
 *                   error: "You have already rated this video."
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', ratingController.createRating);

/**
 * @swagger
 * /api/ratings:
 *   get:
 *     summary: Get all ratings
 *     tags: [Ratings]
 *     responses:
 *       200:
 *         description: List of all ratings with user and video details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Rating'
 *                   - type: object
 *                     properties:
 *                       user:
 *                         type: object
 *                         description: User who created the rating
 *                       video:
 *                         type: object
 *                         description: Video that was rated
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', ratingController.getAllRatings);

/**
 * @swagger
 * /api/ratings/{id}:
 *   get:
 *     summary: Get rating by ID
 *     tags: [Ratings]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The rating ID
 *     responses:
 *       200:
 *         description: Rating details with user and video information
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Rating'
 *                 - type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       description: User who created the rating
 *                     video:
 *                       type: object
 *                       description: Video that was rated
 *       404:
 *         description: Rating not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Rating not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', ratingController.getRatingById);

/**
 * @swagger
 * /api/ratings/{id}:
 *   put:
 *     summary: Update a rating
 *     tags: [Ratings]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The rating ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RatingUpdate'
 *     responses:
 *       200:
 *         description: Rating updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Rating'
 *       400:
 *         description: Invalid score value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Score must be between 1 and 5"
 *       404:
 *         description: Rating not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Rating not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', ratingController.updateRating);

/**
 * @swagger
 * /api/ratings/{id}:
 *   delete:
 *     summary: Delete a rating
 *     tags: [Ratings]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The rating ID
 *     responses:
 *       200:
 *         description: Rating deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               message: "Rating deleted successfully"
 *       404:
 *         description: Rating not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Rating not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', ratingController.deleteRating);

export default router;