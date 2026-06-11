import express from 'express';
import { upload } from '../config/multer.js';
import scoutProfileController from '../controllers/scoutProfileController.js';
import { verifyToken as authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ScoutProfile:
 *       type: object
 *       properties:
 *         id:        { type: integer }
 *         userId:    { type: integer }
 *         avatarUrl: { type: string }
 *         club:      { type: string }
 *         country:   { type: string }
 *         city:      { type: string }
 *         address:   { type: string }
 *         bio:       { type: string }
 *         createdAt: { type: string, format: date-time }
 *         user:
 *           type: object
 *           properties:
 *             id:       { type: integer }
 *             fullname: { type: string }
 *             email:    { type: string }
 *       example:
 *         id: 1
 *         userId: 5
 *         club: Arsenal FC
 *         country: Nigeria
 *         city: Lagos
 *         address: 12 Victoria Island
 *         bio: Senior scout with 10 years experience
 *         avatarUrl: https://storage.googleapis.com/bucket/avatars/file.jpg
 *
 *     ScoutProfileInput:
 *       type: object
 *       properties:
 *         club:    { type: string }
 *         country: { type: string }
 *         city:    { type: string }
 *         address: { type: string }
 *         bio:     { type: string }
 *
 *     ScoutProfileUpdate:
 *       type: object
 *       properties:
 *         club:    { type: string }
 *         country: { type: string }
 *         city:    { type: string }
 *         address: { type: string }
 *         bio:     { type: string }
 *
 *     Error:
 *       type: object
 *       properties:
 *         error: { type: string }
 *       example:
 *         error: Scout profile not found
 */

/**
 * @swagger
 * tags:
 *   name: ScoutProfiles
 *   description: Scout profile management
 */

/**
 * @swagger
 * /api/scoutProfiles/avatar:
 *   post:
 *     summary: Upload or update scout avatar
 *     tags: [ScoutProfiles]
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
 *       400: { description: No image file provided }
 *       401: { description: Not authenticated }
 *       403: { description: Access denied }
 *       404: { description: Scout profile not found }
 *       500: { description: Server error }
 */
// ⚠️ Must be declared BEFORE /:id
router.post(
  '/avatar',
  authenticate,
  authorizeRoles('SCOUT'),
  upload.single('avatar'), // ✅ uses shared diskStorage multer from config
  scoutProfileController.uploadAvatar
);

/**
 * @swagger
 * /api/scoutProfiles:
 *   get:
 *     summary: Get all scout profiles (paginated + filterable)
 *     tags: [ScoutProfiles]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: country
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by scout fullname
 *     responses:
 *       200:
 *         description: Paginated list of scout profiles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ScoutProfile'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:       { type: integer }
 *                     page:        { type: integer }
 *                     limit:       { type: integer }
 *                     totalPages:  { type: integer }
 *                     hasNextPage: { type: boolean }
 *                     hasPrevPage: { type: boolean }
 *       500: { description: Server error }
 */
// ✅ Public - anyone can view all scout profiles
router.get('/', scoutProfileController.getScoutProfiles);

/**
 * @swagger
 * /api/scoutProfiles/{id}:
 *   get:
 *     summary: Get a scout profile by user ID
 *     tags: [ScoutProfiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: User ID
 *     responses:
 *       200:
 *         description: Scout profile details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScoutProfile'
 *       400: { description: Invalid user ID }
 *       404: { description: Scout profile not found }
 *       500: { description: Server error }
 */
// ✅ Public - anyone can view a scout profile
router.get('/:id', scoutProfileController.getScoutProfileById);

/**
 * @swagger
 * /api/scoutProfiles:
 *   put:
 *     summary: Update own scout profile
 *     tags: [ScoutProfiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScoutProfileUpdate'
 *     responses:
 *       200:
 *         description: Scout profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScoutProfile'
 *       401: { description: Not authenticated }
 *       403: { description: Access denied }
 *       404: { description: Scout profile not found }
 *       500: { description: Server error }
 */
// ✅ SCOUT only - updates their own profile via JWT
router.put('/', authenticate, authorizeRoles('SCOUT'), scoutProfileController.updateScoutProfile);

/**
 * @swagger
 * /api/scoutProfiles:
 *   delete:
 *     summary: Delete own scout profile
 *     tags: [ScoutProfiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Scout profile deleted successfully }
 *       401: { description: Not authenticated }
 *       403: { description: Access denied }
 *       404: { description: Scout profile not found }
 *       500: { description: Server error }
 */
// ✅ SCOUT only - deletes their own profile via JWT
router.delete('/', authenticate, authorizeRoles('SCOUT'), scoutProfileController.deleteScoutProfile);

export default router;



