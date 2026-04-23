import express from 'express';
import scouterProfileController from '../controllers/scouterProfileController.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * components:
 *   schemas:
 *     ScouterProfile:
 *       type: object
 *       required:
 *         - userId
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated profile ID
 *         userId:
 *           type: integer
 *           description: ID of the user this profile belongs to
 *         country:
 *           type: string
 *           description: Country of residence
 *         city:
 *           type: string
 *           description: City of residence
 *         address:
 *           type: string
 *           description: Residential Address
 *         bio:
 *           type: string
 *           description: Biography or personal description
 *         avatarUrl:
 *           type: string
 *           description: URL of the profile avatar image
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Profile creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Profile last update timestamp
 *       example:
 *         id: 1
 *         userId: 5
 *         country: "Nigeria"
 *         city: "Lagos"
 *         address: "Lagos"
 *         bio: "Passionate footballer with 5 years of experience"
 *         avatarUrl: "https://storage.googleapis.com/bucket/avatars/file.jpg"
 *
 *     ScouterProfileInput:
 *       type: object
 *       required:
 *         - userId
 *       properties:
 *         userId:
 *           type: integer
 *         country:
 *           type: string
 *         city:
 *           type: string
 *         address:
 *           type: string
 *         bio:
 *           type: string
 */

/**
 * @swagger
 * tags:
 *   name: ScoutProfiles
 *   description: Scouter profile management endpoints
 */

/**
 * @swagger
 * /api/scoutProfiles:
 *   post:
 *     summary: Create a new scouter profile
 *     tags: [ScoutProfiles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScouterProfileInput'
 *     responses:
 *       201:
 *         description: Profile created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Profile created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ScouterProfile'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/", scouterProfileController.createScoutProfile);

/**
 * @swagger
 * /api/scoutProfiles:
 *   get:
 *     summary: Get all scouter profiles
 *     tags: [ScoutProfiles]
 *     responses:
 *       200:
 *         description: List of all scouter profiles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/ScouterProfile'
 *                   - type: object
 *                     properties:
 *                       user:
 *                         type: object
 *                         description: Associated user information
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", scouterProfileController.getScoutProfiles);

/**
 * @swagger
 * /api/scoutProfiles/avatar:
 *   post:
 *     summary: Upload or update profile avatar
 *     tags: [ScoutProfiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Image file to upload
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Avatar uploaded successfully"
 *                 avatarUrl:
 *                   type: string
 *                   example: "https://storage.googleapis.com/bucket/avatars/file.jpg"
 *       400:
 *         description: No image file provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Profile not found
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
// ✅ Avatar route BEFORE /:id to prevent route conflict
router.post("/avatar", upload.single("avatar"), scouterProfileController.uploadAvatar);

/**
 * @swagger
 * /api/scoutProfiles/{id}:
 *   get:
 *     summary: Get a scouter profile by ID
 *     tags: [ScoutProfiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Profile ID
 *     responses:
 *       200:
 *         description: Profile details
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ScouterProfile'
 *                 - type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       description: Associated user information
 *       404:
 *         description: Profile not found
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
router.get("/:id", scouterProfileController.getScoutProfileById);

/**
 * @swagger
 * /api/scoutProfiles/{id}:
 *   put:
 *     summary: Update a scouter profile
 *     tags: [ScoutProfiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Profile ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               country:
 *                 type: string
 *               city:
 *                 type: string
 *               address:
 *                 type: string
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Profile updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ScouterProfile'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put("/:id", scouterProfileController.updateScoutProfile);

/**
 * @swagger
 * /api/scoutProfiles/{id}:
 *   delete:
 *     summary: Delete a scouter profile
 *     tags: [ScoutProfiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Profile ID
 *     responses:
 *       200:
 *         description: Profile deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Profile deleted successfully"
 *       404:
 *         description: Profile not found
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
router.delete("/:id", scouterProfileController.deleteScoutProfile);

export default router;