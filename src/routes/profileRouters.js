import express from 'express';
import multer from 'multer';
import profileController from '../controllers/profileController.js';
import { verifyToken as authenticate } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * components:
 *   schemas:
 *     Profile:
 *       type: object
 *       properties:
 *         id:             { type: integer }
 *         userId:         { type: integer }
 *         avatarUrl:      { type: string }
 *         position:       { type: string }
 *         height:         { type: number, format: float }
 *         favouriteFoot:  { type: string, enum: [Left, Right, Both] }
 *         strengths:      { type: string }
 *         gender:         { type: string, enum: [Male, Female, Other] }
 *         country:        { type: string }
 *         city:           { type: string }
 *         dob:            { type: string, format: date }
 *         bio:            { type: string }
 *         createdAt:      { type: string, format: date-time }
 *         user:
 *           type: object
 *           properties:
 *             id:       { type: integer }
 *             fullname: { type: string }
 *             email:    { type: string }
 *       example:
 *         id: 1
 *         userId: 5
 *         position: Forward
 *         height: 180.5
 *         favouriteFoot: Right
 *         strengths: Speed, Dribbling
 *         gender: Male
 *         country: Nigeria
 *         city: Lagos
 *         dob: "1995-05-15"
 *         bio: Passionate footballer with 5 years of experience
 *
 *     ProfileInput:
 *       type: object
 *       required: [userId]
 *       properties:
 *         userId:         { type: integer }
 *         position:       { type: string }
 *         height:         { type: number }
 *         favouriteFoot:  { type: string, enum: [Left, Right, Both] }
 *         strengths:      { type: string }
 *         gender:         { type: string, enum: [Male, Female, Other] }
 *         country:        { type: string }
 *         city:           { type: string }
 *         dob:            { type: string, format: date }
 *         bio:            { type: string }
 *
 *     ProfileUpdate:
 *       type: object
 *       properties:
 *         position:       { type: string }
 *         height:         { type: number }
 *         favouriteFoot:  { type: string, enum: [Left, Right, Both] }
 *         strengths:      { type: string }
 *         gender:         { type: string, enum: [Male, Female, Other] }
 *         country:        { type: string }
 *         city:           { type: string }
 *         dob:            { type: string, format: date }
 *         bio:            { type: string }
 *
 *     Error:
 *       type: object
 *       properties:
 *         error: { type: string }
 *       example:
 *         error: Profile not found
 */

/**
 * @swagger
 * tags:
 *   name: Profiles
 *   description: Player profile management
 */

/**
 * @swagger
 * /api/profiles/avatar:
 *   post:
 *     summary: Upload or update profile avatar
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:   { type: string }
 *                 avatarUrl: { type: string }
 *       400:
 *         description: No image file provided
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Server error
 */
// ⚠️ Must be declared BEFORE /:id to avoid Express matching "avatar" as an id param
router.post('/avatar', authenticate, upload.single('avatar'), profileController.uploadAvatar);


/**
 * @swagger
 * /api/profiles:
 *   get:
 *     summary: Get all profiles (paginated + filterable)
 *     tags: [Profiles]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: position
 *         schema: { type: string }
 *       - in: query
 *         name: country
 *         schema: { type: string }
 *       - in: query
 *         name: gender
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by player fullname
 *     responses:
 *       200:
 *         description: Paginated list of profiles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Profile'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:       { type: integer }
 *                     page:        { type: integer }
 *                     limit:       { type: integer }
 *                     totalPages:  { type: integer }
 *                     hasNextPage: { type: boolean }
 *                     hasPrevPage: { type: boolean }
 *       500:
 *         description: Server error
 */
router.get('/', profileController.getProfiles);

/**
 * @swagger
 * /api/profiles/{id}:
 *   get:
 *     summary: Get a profile by ID
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Profile details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       400:
 *         description: Invalid profile ID
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Server error
 */
router.get('/:id', profileController.getProfileById);

/**
 * @swagger
 * /api/profiles/{id}:
 *   put:
 *     summary: Update a profile
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProfileUpdate'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       400:
 *         description: Invalid profile ID
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Server error
 */
router.put('/:id', profileController.updateProfile);

/**
 * @swagger
 * /api/profiles/{id}:
 *   delete:
 *     summary: Delete a profile
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Profile deleted successfully
 *       400:
 *         description: Invalid profile ID
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', profileController.deleteProfile);

export default router;



















