import express from "express";
import userController from "../controllers/userController.js";
import { verifyToken as authenticate, authorizeRoles } from "../middleware/auth.js";

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
 *       required:
 *         - email
 *         - password
 *         - fullname
 *       properties:
 *         id:
 *           type: integer
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *         fullname:
 *           type: string
 *         role:
 *           type: string
 *           enum: [PLAYER, SCOUT, ADMIN]
 *         createdAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: 1
 *         email: user@example.com
 *         fullname: John Doe
 *         role: PLAYER
 *         createdAt: 2024-01-01T00:00:00.000Z
 *
 *     RegisterInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - fullname
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *           minLength: 6
 *         fullname:
 *           type: string
 *         role:
 *           type: string
 *           enum: [PLAYER, SCOUT, ADMIN]
 *           default: PLAYER
 *       example:
 *         email: player@example.com
 *         password: securePassword123
 *         fullname: John Doe
 *         role: PLAYER
 *
 *     LoginInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *       example:
 *         email: player@example.com
 *         password: securePassword123
 *
 *     AuthResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         user:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             email:
 *               type: string
 *             fullname:
 *               type: string
 *             role:
 *               type: string
 *             createdAt:
 *               type: string
 *               format: date-time
 *         token:
 *           type: string
 *       example:
 *         message: Login successful
 *         user:
 *           id: 1
 *           email: player@example.com
 *           fullname: John Doe
 *           role: PLAYER
 *           createdAt: 2024-01-01T00:00:00.000Z
 *         token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 *     OtpInput:
 *       type: object
 *       required:
 *         - email
 *         - otp
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         otp:
 *           type: string
 *           minLength: 6
 *           maxLength: 6
 *       example:
 *         email: player@example.com
 *         otp: "482910"
 *
 *     ForgotPasswordInput:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *       example:
 *         email: player@example.com
 *
 *     ResetPasswordInput:
 *       type: object
 *       required:
 *         - resetToken
 *         - newPassword
 *       properties:
 *         resetToken:
 *           type: string
 *         newPassword:
 *           type: string
 *           format: password
 *           minLength: 6
 *       example:
 *         resetToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         newPassword: newSecurePassword123
 *
 *     UpdatePasswordInput:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *       properties:
 *         currentPassword:
 *           type: string
 *           format: password
 *         newPassword:
 *           type: string
 *           format: password
 *           minLength: 6
 *       example:
 *         currentPassword: oldPassword123
 *         newPassword: newSecurePassword123
 *
 *     UserInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - fullname
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *           minLength: 6
 *         fullname:
 *           type: string
 *         role:
 *           type: string
 *           enum: [PLAYER, SCOUT, ADMIN]
 *       example:
 *         email: user@example.com
 *         password: securePassword123
 *         fullname: John Doe
 *         role: PLAYER
 *
 *     UserUpdate:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *           minLength: 6
 *         fullname:
 *           type: string
 *         role:
 *           type: string
 *           enum: [PLAYER, SCOUT, ADMIN]
 *       example:
 *         email: newemail@example.com
 *         fullname: Jane Doe
 *
 *     Error:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *       example:
 *         message: Error description
 */

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: Register, login, OTP verification
 *   - name: Password
 *     description: Forgot password, reset password, update password
 *   - name: Users
 *     description: User management (CRUD - Admin only)
 */

// ========================================
// PUBLIC ROUTES (No authentication required)
// ========================================

/**
 * @swagger
 * /users/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     description: Creates a new account and sends a 6-digit OTP to the user's email for verification.
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
router.post("/register", userController.register);

/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     description: Authenticate user and receive a JWT token.
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
 *         description: Missing required fields
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post("/login", userController.login);

/**
 * @swagger
 * /users/verify-otp:
 *   post:
 *     summary: Verify account OTP
 *     tags: [Authentication]
 *     description: Verifies the 6-digit OTP sent to the user's email after registration.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OtpInput'
 *     responses:
 *       200:
 *         description: Account verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 message: Account verified successfully!
 *       400:
 *         description: Invalid or expired OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post("/verify-otp", userController.verifyOTP);

/**
 * @swagger
 * /users/resend-otp:
 *   post:
 *     summary: Resend verification OTP
 *     tags: [Authentication]
 *     description: Resends a new 6-digit OTP to the user's email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordInput'
 *     responses:
 *       200:
 *         description: New OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 message: A new OTP has been sent to your email.
 *       400:
 *         description: Account already verified
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post("/resend-otp", userController.resendOTP);

/**
 * @swagger
 * /users/forgot-password:
 *   post:
 *     summary: Request a password reset OTP
 *     tags: [Password]
 *     description: Sends a 6-digit OTP to the user's email to initiate a password reset.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordInput'
 *     responses:
 *       200:
 *         description: Reset OTP sent (response is the same whether email exists or not for security)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 message: If this email exists, a reset code has been sent.
 *       500:
 *         description: Server error
 */
router.post("/forgot-password", userController.forgotPassword);

/**
 * @swagger
 * /users/verify-reset-otp:
 *   post:
 *     summary: Verify password reset OTP
 *     tags: [Password]
 *     description: Verifies the OTP sent for password reset. Returns a short-lived resetToken (valid 15 min).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OtpInput'
 *     responses:
 *       200:
 *         description: OTP verified. Reset token returned.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 resetToken:
 *                   type: string
 *               example:
 *                 message: OTP verified. Use the reset token to set a new password.
 *                 resetToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post("/verify-reset-otp", userController.verifyResetOTP);

/**
 * @swagger
 * /users/reset-password:
 *   post:
 *     summary: Reset password using reset token
 *     tags: [Password]
 *     description: Sets a new password using the resetToken received from verify-reset-otp.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordInput'
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 message: Password reset successfully. You can now log in.
 *       400:
 *         description: Missing fields or weak password
 *       401:
 *         description: Invalid or expired reset token
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post("/reset-password", userController.resetPassword);

// ========================================
// PROTECTED ROUTES (Authentication required)
// ========================================

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user profile
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
router.get("/me", authenticate, userController.getCurrentUser);

/**
 * @swagger
 * /users/update-password:
 *   put:
 *     summary: Update password (logged-in user)
 *     tags: [Password]
 *     description: Allows an authenticated user to change their own password by providing their current password.
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 message: Password updated successfully.
 *       400:
 *         description: Missing fields, weak password, or same as current
 *       401:
 *         description: Current password is incorrect or not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put("/update-password", authenticate, userController.updatePassword);

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
 *         schema:
 *           type: integer
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
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
router.get("/:id", authenticate, userController.getUserById);

// ========================================
// ADMIN ONLY ROUTES
// ========================================

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserInput'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Email already in use or invalid role
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Server error
 */
// router.post("/", userController.createUser);

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
router.get("/", userController.getUsers);

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
 *         schema:
 *           type: integer
 *         required: true
 *         description: User ID
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
 *         description: Invalid role
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put("/:id", userController.updateUser);

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
 *         schema:
 *           type: integer
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", authenticate, authorizeRoles('ADMIN'), userController.deleteUser);

export default router;