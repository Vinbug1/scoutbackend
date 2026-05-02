import express from 'express';
import multer from 'multer';
import scouterProfileController from '../controllers/scouterProfileController.js';
import { verifyToken as authenticate } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * components:
 *   schemas:
 *     ScouterProfile:
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
 *     ScouterProfileInput:
 *       type: object
 *       required: [userId]
 *       properties:
 *         userId:  { type: integer }
 *         club:    { type: string }
 *         country: { type: string }
 *         city:    { type: string }
 *         address: { type: string }
 *         bio:     { type: string }
 *
 *     ScouterProfileUpdate:
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
 *     summary: Upload or update scout profile avatar
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
 *       400:
 *         description: No image file provided
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Scout profile not found
 *       500:
 *         description: Server error
 */
// ⚠️ Must be declared BEFORE /:id to prevent Express matching "avatar" as an id param
router.post('/avatar', authenticate, upload.single('avatar'), scouterProfileController.uploadAvatar);

/**
 * @swagger
 * /api/scoutProfiles:
 *   post:
 *     summary: Create a new scout profile
 *     tags: [ScoutProfiles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScouterProfileInput'
 *     responses:
 *       201:
 *         description: Scout profile created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScouterProfile'
 *       400:
 *         description: Missing userId or profile already exists
 *       403:
 *         description: User is not a scout
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/', scouterProfileController.createScoutProfile);

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
 *                     $ref: '#/components/schemas/ScouterProfile'
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
router.get('/', scouterProfileController.getScoutProfiles);

/**
 * @swagger
 * /api/scoutProfiles/{id}:
 *   get:
 *     summary: Get a scout profile by ID
 *     tags: [ScoutProfiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Scout profile details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScouterProfile'
 *       400:
 *         description: Invalid profile ID
 *       404:
 *         description: Scout profile not found
 *       500:
 *         description: Server error
 */
router.get('/:id', scouterProfileController.getScoutProfileById);

/**
 * @swagger
 * /api/scoutProfiles/{id}:
 *   put:
 *     summary: Update a scout profile
 *     tags: [ScoutProfiles]
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
 *             $ref: '#/components/schemas/ScouterProfileUpdate'
 *     responses:
 *       200:
 *         description: Scout profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScouterProfile'
 *       400:
 *         description: Invalid profile ID
 *       404:
 *         description: Scout profile not found
 *       500:
 *         description: Server error
 */
router.put('/:id', scouterProfileController.updateScoutProfile);

/**
 * @swagger
 * /api/scoutProfiles/{id}:
 *   delete:
 *     summary: Delete a scout profile
 *     tags: [ScoutProfiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Scout profile deleted successfully
 *       400:
 *         description: Invalid profile ID
 *       404:
 *         description: Scout profile not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', scouterProfileController.deleteScoutProfile);

export default router;





















// import express from 'express';
// import scouterProfileController from '../controllers/scouterProfileController.js';
// import multer from 'multer';

// const router = express.Router();
// const upload = multer({ storage: multer.memoryStorage() });

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     ScouterProfile:
//  *       type: object
//  *       required:
//  *         - userId
//  *       properties:
//  *         id:
//  *           type: integer
//  *           description: Auto-generated profile ID
//  *         userId:
//  *           type: integer
//  *           description: ID of the user this profile belongs to
//  *         country:
//  *           type: string
//  *           description: Country of residence
//  *         city:
//  *           type: string
//  *           description: City of residence
//  *         address:
//  *           type: string
//  *           description: Residential Address
//  *         bio:
//  *           type: string
//  *           description: Biography or personal description
//  *         avatarUrl:
//  *           type: string
//  *           description: URL of the profile avatar image
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           description: Profile creation timestamp
//  *         updatedAt:
//  *           type: string
//  *           format: date-time
//  *           description: Profile last update timestamp
//  *       example:
//  *         id: 1
//  *         userId: 5
//  *         country: "Nigeria"
//  *         city: "Lagos"
//  *         address: "Lagos"
//  *         bio: "Passionate footballer with 5 years of experience"
//  *         avatarUrl: "https://storage.googleapis.com/bucket/avatars/file.jpg"
//  *
//  *     ScouterProfileInput:
//  *       type: object
//  *       required:
//  *         - userId
//  *       properties:
//  *         userId:
//  *           type: integer
//  *         country:
//  *           type: string
//  *         city:
//  *           type: string
//  *         address:
//  *           type: string
//  *         bio:
//  *           type: string
//  */

// /**
//  * @swagger
//  * tags:
//  *   name: ScoutProfiles
//  *   description: Scouter profile management endpoints
//  */

// /**
//  * @swagger
//  * /api/scoutProfiles:
//  *   post:
//  *     summary: Create a new scouter profile
//  *     tags: [ScoutProfiles]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/ScouterProfileInput'
//  *     responses:
//  *       201:
//  *         description: Profile created successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *                   example: "Profile created successfully"
//  *                 data:
//  *                   $ref: '#/components/schemas/ScouterProfile'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.post("/", scouterProfileController.createScoutProfile);

// /**
//  * @swagger
//  * /api/scoutProfiles:
//  *   get:
//  *     summary: Get all scouter profiles
//  *     tags: [ScoutProfiles]
//  *     responses:
//  *       200:
//  *         description: List of all scouter profiles
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items:
//  *                 allOf:
//  *                   - $ref: '#/components/schemas/ScouterProfile'
//  *                   - type: object
//  *                     properties:
//  *                       user:
//  *                         type: object
//  *                         description: Associated user information
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get("/", scouterProfileController.getScoutProfiles);

// /**
//  * @swagger
//  * /api/scoutProfiles/avatar:
//  *   post:
//  *     summary: Upload or update profile avatar
//  *     tags: [ScoutProfiles]
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         multipart/form-data:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - avatar
//  *             properties:
//  *               avatar:
//  *                 type: string
//  *                 format: binary
//  *                 description: Image file to upload
//  *     responses:
//  *       200:
//  *         description: Avatar uploaded successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *                   example: "Avatar uploaded successfully"
//  *                 avatarUrl:
//  *                   type: string
//  *                   example: "https://storage.googleapis.com/bucket/avatars/file.jpg"
//  *       400:
//  *         description: No image file provided
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       404:
//  *         description: Profile not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// // ✅ Avatar route BEFORE /:id to prevent route conflict
// router.post("/avatar", upload.single("avatar"), scouterProfileController.uploadAvatar);

// /**
//  * @swagger
//  * /api/scoutProfiles/{id}:
//  *   get:
//  *     summary: Get a scouter profile by ID
//  *     tags: [ScoutProfiles]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: Profile ID
//  *     responses:
//  *       200:
//  *         description: Profile details
//  *         content:
//  *           application/json:
//  *             schema:
//  *               allOf:
//  *                 - $ref: '#/components/schemas/ScouterProfile'
//  *                 - type: object
//  *                   properties:
//  *                     user:
//  *                       type: object
//  *                       description: Associated user information
//  *       404:
//  *         description: Profile not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.get("/:id", scouterProfileController.getScoutProfileById);

// /**
//  * @swagger
//  * /api/scoutProfiles/{id}:
//  *   put:
//  *     summary: Update a scouter profile
//  *     tags: [ScoutProfiles]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: Profile ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               country:
//  *                 type: string
//  *               city:
//  *                 type: string
//  *               address:
//  *                 type: string
//  *               bio:
//  *                 type: string
//  *     responses:
//  *       200:
//  *         description: Profile updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *                   example: "Profile updated successfully"
//  *                 data:
//  *                   $ref: '#/components/schemas/ScouterProfile'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.put("/:id", scouterProfileController.updateScoutProfile);

// /**
//  * @swagger
//  * /api/scoutProfiles/{id}:
//  *   delete:
//  *     summary: Delete a scouter profile
//  *     tags: [ScoutProfiles]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *         description: Profile ID
//  *     responses:
//  *       200:
//  *         description: Profile deleted successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *                   example: "Profile deleted successfully"
//  *       404:
//  *         description: Profile not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Error'
//  */
// router.delete("/:id", scouterProfileController.deleteScoutProfile);

// export default router;