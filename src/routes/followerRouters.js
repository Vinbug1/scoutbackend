import express from 'express';
const router = express.Router();
import followerController from '../controllers/followerController.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The user ID
 *         username:
 *           type: string
 *           description: The username
 *         email:
 *           type: string
 *           description: The user email
 *     
 *     Follower:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The follower relationship ID
 *         followerId:
 *           type: integer
 *           description: The ID of the user who is following
 *         followedId:
 *           type: integer
 *           description: The ID of the user being followed
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the relationship was created
 *         follower:
 *           $ref: '#/components/schemas/User'
 *         followed:
 *           $ref: '#/components/schemas/User'
 *     
 *     FollowerInput:
 *       type: object
 *       required:
 *         - followerId
 *         - followedId
 *       properties:
 *         followerId:
 *           type: integer
 *           description: The ID of the user who will follow
 *         followedId:
 *           type: integer
 *           description: The ID of the user to be followed
 *     
 *     FollowerUpdateInput:
 *       type: object
 *       required:
 *         - followedId
 *       properties:
 *         followedId:
 *           type: integer
 *           description: The new ID of the user to be followed
 *     
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 */

/**
 * @swagger
 * /api/followers:
 *   get:
 *     summary: Get all follower relationships
 *     tags: [Followers]
 *     description: Retrieve a list of all follower relationships including follower and followed user details
 *     responses:
 *       200:
 *         description: A list of follower relationships
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Follower'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', followerController.getAll);

/**
 * @swagger
 * /api/followers/{id}:
 *   get:
 *     summary: Get a follower relationship by ID
 *     tags: [Followers]
 *     description: Retrieve a specific follower relationship by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The follower relationship ID
 *     responses:
 *       200:
 *         description: The follower relationship details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Follower'
 *       404:
 *         description: Follower relationship not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', followerController.getById);

/**
 * @swagger
 * /api/followers:
 *   post:
 *     summary: Create a new follower relationship
 *     tags: [Followers]
 *     description: Create a new follow relationship between two users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FollowerInput'
 *           example:
 *             followerId: 1
 *             followedId: 2
 *     responses:
 *       201:
 *         description: Follower relationship created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Follower'
 *       400:
 *         description: Bad request (user cannot follow themselves or relationship already exists)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', followerController.create);

/**
 * @swagger
 * /api/followers/{id}:
 *   put:
 *     summary: Update a follower relationship
 *     tags: [Followers]
 *     description: Update the followed user in an existing follower relationship
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The follower relationship ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FollowerUpdateInput'
 *           example:
 *             followedId: 3
 *     responses:
 *       200:
 *         description: Follower relationship updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Follower'
 *       400:
 *         description: Bad request (relationship already exists)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Follower relationship not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', followerController.update);

/**
 * @swagger
 * /api/followers/{id}:
 *   delete:
 *     summary: Delete a follower relationship
 *     tags: [Followers]
 *     description: Remove a follower relationship by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The follower relationship ID
 *     responses:
 *       200:
 *         description: Follower relationship deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Follower relationship deleted successfully
 *       404:
 *         description: Follower relationship not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', followerController.delete);

export default router;