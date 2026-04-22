import express from 'express';
const router = express.Router();
import scoutProfileController from '../controllers/scoutProfileController.js';
import multer from 'multer';                                        // 👈 add this

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
 *           format: date
 *           description: Residential Address
 *         bio:
 *           type: string
 *           description: Biography or personal description
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
 *         address: "lagos"
 *         bio: "Passionate footballer with 5 years of experience"
 *     
 *     ProfileInput:
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
 * tags:
 *   name: ScouterProfiles
 *   description: Scouter profile management endpoints
 */

/**
 * @swagger
 * /api/profiles:
 *   post:
 *     summary: Create a new scouterProfile
 *     tags: [Profiles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProfileInput'
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
 *                   $ref: '#/components/schemas/Profile'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/", scoutProfileController.createScoutProfile);

/**
 * @swagger
 * /api/profiles:
 *   get:
 *     summary: Get all scouterProfiles
 *     tags: [Profiles]
 *     responses:
 *       200:
 *         description: List of all profiles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Profile'
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
router.get("/", scoutProfileController.getScoutProfiles);

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
 *                 - $ref: '#/components/schemas/Profile'
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
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Profile not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:id", scoutProfileController.getScoutProfileById);

/**
 * @swagger
 * /api/profiles/{id}:
 *   put:
 *     summary: Update a Scouterprofile
 *     tags: [Profiles]
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
 *                   $ref: '#/components/schemas/Profile'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put("/:id", scoutProfileController.updateScoutProfile);

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
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete("/:id", scoutProfileController.deleteScoutProfile);

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
router.post("/avatar", upload.single("avatar"), scoutProfileController.uploadAvatar);


export default router;