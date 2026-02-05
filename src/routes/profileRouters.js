import express from 'express';
const router = express.Router();
import profileController from '../controllers/profileController.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Profile:
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
 *         position:
 *           type: string
 *           description: Player position (e.g., Forward, Midfielder, Defender, Goalkeeper)
 *         height:
 *           type: number
 *           format: float
 *           description: Height in centimeters
 *         favouriteFoot:
 *           type: string
 *           enum: [Left, Right, Both]
 *           description: Preferred foot for playing
 *         strengths:
 *           type: string
 *           description: Player strengths and skills
 *         gender:
 *           type: string
 *           enum: [Male, Female, Other]
 *           description: Gender
 *         country:
 *           type: string
 *           description: Country of residence
 *         city:
 *           type: string
 *           description: City of residence
 *         dob:
 *           type: string
 *           format: date
 *           description: Date of birth (YYYY-MM-DD)
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
 *         position: "Forward"
 *         height: 180.5
 *         favouriteFoot: "Right"
 *         strengths: "Speed, Dribbling, Finishing"
 *         gender: "Male"
 *         country: "Nigeria"
 *         city: "Lagos"
 *         dob: "1995-05-15"
 *         bio: "Passionate footballer with 5 years of experience"
 *     
 *     ProfileInput:
 *       type: object
 *       required:
 *         - userId
 *       properties:
 *         userId:
 *           type: integer
 *         position:
 *           type: string
 *         height:
 *           type: number
 *         favouriteFoot:
 *           type: string
 *         strengths:
 *           type: string
 *         gender:
 *           type: string
 *         country:
 *           type: string
 *         city:
 *           type: string
 *         dob:
 *           type: string
 *           format: date
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
 *   name: Profiles
 *   description: Player profile management endpoints
 */

/**
 * @swagger
 * /api/profiles:
 *   post:
 *     summary: Create a new profile
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
router.post("/", profileController.createProfile);

/**
 * @swagger
 * /api/profiles:
 *   get:
 *     summary: Get all profiles
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
router.get("/", profileController.getProfiles);

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
router.get("/:id", profileController.getProfileById);

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
 *               position:
 *                 type: string
 *               height:
 *                 type: number
 *               favouriteFoot:
 *                 type: string
 *               strengths:
 *                 type: string
 *               gender:
 *                 type: string
 *               country:
 *                 type: string
 *               city:
 *                 type: string
 *               dob:
 *                 type: string
 *                 format: date
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
router.put("/:id", profileController.updateProfile);

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
router.delete("/:id", profileController.deleteProfile);

export default router;