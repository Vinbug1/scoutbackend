import express from 'express';
const router = express.Router();
import paymentController from '../controllers/paymentController.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Payment:
 *       type: object
 *       required:
 *         - userId
 *         - amount
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated payment ID
 *         userId:
 *           type: integer
 *           description: ID of the user making the payment
 *         amount:
 *           type: number
 *           format: float
 *           description: Payment amount
 *         currency:
 *           type: string
 *           default: USD
 *           description: Currency code (e.g., USD, EUR, GBP)
 *         status:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, CANCELLED]
 *           default: PENDING
 *           description: Current status of the payment
 *         providerRef:
 *           type: string
 *           description: Payment provider reference ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Payment creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Payment last update timestamp
 *         user:
 *           type: object
 *           description: User object (included in responses)
 *       example:
 *         id: 1
 *         userId: 123
 *         amount: 99.99
 *         currency: USD
 *         status: PENDING
 *         providerRef: "pay_1234567890"
 *         createdAt: "2024-01-15T10:30:00Z"
 *         updatedAt: "2024-01-15T10:30:00Z"
 *
 *     PaymentInput:
 *       type: object
 *       required:
 *         - userId
 *         - amount
 *       properties:
 *         userId:
 *           type: integer
 *           description: ID of the user making the payment
 *         amount:
 *           type: number
 *           format: float
 *           description: Payment amount
 *         currency:
 *           type: string
 *           default: USD
 *           description: Currency code
 *         status:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, CANCELLED]
 *           description: Payment status
 *         providerRef:
 *           type: string
 *           description: Payment provider reference ID
 *       example:
 *         userId: 123
 *         amount: 99.99
 *         currency: USD
 *         status: PENDING
 *         providerRef: "pay_1234567890"
 *
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *       example:
 *         error: "Failed to create payment."
 */

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment management API
 */

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create a new payment
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentInput'
 *     responses:
 *       201:
 *         description: Payment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/", paymentController.createPayment);

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get all payments
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: List of all payments with user details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Payment'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", paymentController.getAllPayments);

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Get payment by ID
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment details with user information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       404:
 *         description: Payment not found
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
router.get("/:id", paymentController.getPaymentById);

/**
 * @swagger
 * /api/payments/{id}:
 *   put:
 *     summary: Update payment by ID
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Payment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 format: float
 *               currency:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [PENDING, COMPLETED, FAILED, CANCELLED]
 *               providerRef:
 *                 type: string
 *             example:
 *               amount: 149.99
 *               currency: USD
 *               status: COMPLETED
 *               providerRef: "pay_9876543210"
 *     responses:
 *       200:
 *         description: Payment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       404:
 *         description: Payment not found
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
router.put("/:id", paymentController.updatePayment);

/**
 * @swagger
 * /api/payments/{id}:
 *   delete:
 *     summary: Delete payment by ID
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *               example:
 *                 message: "Payment deleted successfully."
 *       404:
 *         description: Payment not found
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
router.delete("/:id", paymentController.deletePayment);

// Optional extra routes if needed
// router.get("/user/:userId", paymentController.getPaymentsByUser);
// router.get("/status/:status", paymentController.getPaymentsByStatus);

export default router;