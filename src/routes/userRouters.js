import express from 'express';
import userController from '../controllers/userController.js';
import { verifyToken as authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: Enter your JWT token in the format **Bearer &lt;token&gt;**
 *
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:           { type: integer }
 *         email:        { type: string, format: email }
 *         fullname:     { type: string }
 *         role:         { type: string, enum: [PLAYER, SCOUT, ADMIN] }
 *         createdAt:    { type: string, format: date-time }
 *       example:
 *         id: 1
 *         email: user@example.com
 *         fullname: John Doe
 *         role: PLAYER
 *         createdAt: 2024-01-01T00:00:00.000Z
 *
 *     RegisterInput:
 *       type: object
 *       required: [email, password, fullname]
 *       properties:
 *         email:    { type: string, format: email }
 *         password: { type: string, format: password, minLength: 6 }
 *         fullname: { type: string }
 *         role:     { type: string, enum: [PLAYER, SCOUT, ADMIN], default: PLAYER }
 *       example:
 *         email: player@example.com
 *         password: securePassword123
 *         fullname: John Doe
 *         role: PLAYER
 *
 *     LoginInput:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:    { type: string, format: email }
 *         password: { type: string, format: password }
 *       example:
 *         email: player@example.com
 *         password: securePassword123
 *
 *     AuthResponse:
 *       type: object
 *       properties:
 *         message: { type: string }
 *         user:    { $ref: '#/components/schemas/User' }
 *         token:   { type: string }
 *       example:
 *         message: Login successful
 *         user: { id: 1, email: player@example.com, fullname: John Doe, role: PLAYER }
 *         token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 *     OtpInput:
 *       type: object
 *       required: [email, otp]
 *       properties:
 *         email: { type: string, format: email }
 *         otp:   { type: string, minLength: 6, maxLength: 6 }
 *       example:
 *         email: player@example.com
 *         otp: "482910"
 *
 *     ForgotPasswordInput:
 *       type: object
 *       required: [email]
 *       properties:
 *         email: { type: string, format: email }
 *       example:
 *         email: player@example.com
 *
 *     ResetPasswordInput:
 *       type: object
 *       required: [resetToken, newPassword]
 *       properties:
 *         resetToken:  { type: string }
 *         newPassword: { type: string, format: password, minLength: 6 }
 *       example:
 *         resetToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         newPassword: newSecurePassword123
 *
 *     UpdatePasswordInput:
 *       type: object
 *       required: [currentPassword, newPassword]
 *       properties:
 *         currentPassword: { type: string, format: password }
 *         newPassword:     { type: string, format: password, minLength: 6 }
 *       example:
 *         currentPassword: oldPassword123
 *         newPassword: newSecurePassword123
 *
 *     UserUpdate:
 *       type: object
 *       properties:
 *         email:    { type: string, format: email }
 *         password: { type: string, format: password, minLength: 6 }
 *         fullname: { type: string }
 *         role:     { type: string, enum: [PLAYER, SCOUT, ADMIN] }
 *       example:
 *         email: newemail@example.com
 *         fullname: Jane Doe
 *
 *     Error:
 *       type: object
 *       properties:
 *         message: { type: string }
 *       example:
 *         message: Error description
 */

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: Register, login, OTP verification
 *   - name: Password
 *     description: Forgot, reset, and update password flows
 *   - name: Users
 *     description: User management (Admin only for write operations)
 */

// ========================================
// PUBLIC ROUTES
// ========================================

/**
 * @swagger
 * /users/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterInput'
 *     responses:
 *       201:
 *         description: Registration successful. OTP sent to email.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error or email already in use
 *       500:
 *         description: Server error
 */
router.post('/register', userController.register);

/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Missing fields
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post('/login', userController.login);

/**
 * @swagger
 * /users/verify-otp:
 *   post:
 *     summary: Verify account OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OtpInput'
 *     responses:
 *       200:
 *         description: Account verified successfully
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/verify-otp', userController.verifyOTP);

/**
 * @swagger
 * /users/resend-otp:
 *   post:
 *     summary: Resend verification OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordInput'
 *     responses:
 *       200:
 *         description: New OTP sent successfully
 *       400:
 *         description: Account already verified
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/resend-otp', userController.resendOTP);

/**
 * @swagger
 * /users/forgot-password:
 *   post:
 *     summary: Request a password reset OTP
 *     tags: [Password]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordInput'
 *     responses:
 *       200:
 *         description: Reset OTP sent (same response whether email exists or not)
 *       500:
 *         description: Server error
 */
router.post('/forgot-password', userController.forgotPassword);

/**
 * @swagger
 * /users/verify-reset-otp:
 *   post:
 *     summary: Verify password reset OTP
 *     tags: [Password]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OtpInput'
 *     responses:
 *       200:
 *         description: OTP verified. Returns short-lived resetToken (15 min).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:    { type: string }
 *                 resetToken: { type: string }
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/verify-reset-otp', userController.verifyResetOTP);

/**
 * @swagger
 * /users/reset-password:
 *   post:
 *     summary: Reset password using reset token
 *     tags: [Password]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordInput'
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Missing fields or weak password
 *       401:
 *         description: Invalid or expired reset token
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/reset-password', userController.resetPassword);

// ========================================
// PROTECTED ROUTES
// ========================================

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current logged-in user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/me', authenticate, userController.getCurrentUser);

/**
 * @swagger
 * /users/update-password:
 *   put:
 *     summary: Update password (logged-in user)
 *     tags: [Password]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePasswordInput'
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Missing fields, weak password, or same as current
 *       401:
 *         description: Incorrect current password or not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put('/update-password', authenticate, userController.updatePassword);

/**
 * @swagger
 * /users/players:
 *   get:
 *     summary: Get all players
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users with role PLAYER
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/players', authenticate, userController.getAllPlayers);

/**
 * @swagger
 * /users/players/{id}:
 *   get:
 *     summary: Get a player by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: The ID of the player to retrieve
 *     responses:
 *       200:
 *         description: Player details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid player ID
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: User exists but is not a player
 *       404:
 *         description: Player not found
 *       500:
 *         description: Server error
 */
router.get('/players/:id', authenticate, userController.getPlayerById);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/:id', authenticate, userController.getUserById);

// ========================================
// ADMIN ONLY ROUTES
// ========================================

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Server error
 */
router.get('/', authorizeRoles('ADMIN'), userController.getUsers);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update a user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
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
 *             $ref: '#/components/schemas/UserUpdate'
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Invalid role or user ID
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put('/:id', authenticate, authorizeRoles('ADMIN'), userController.updateUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', authenticate, authorizeRoles('ADMIN'), userController.deleteUser);

export default router;

