import express from 'express';
import waitlistController from '../controllers/waitlistController.js';
import { verifyToken as  protect, authorizeRoles } from '../middleware/auth.js';
import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

// Public route
router.post('/', waitlistController.join);

// Admin-only routes
router.get('/', protect,authorizeRoles('ADMIN'),waitlistController.getAll);

router.get('/:id',protect,authorizeRoles('ADMIN'),waitlistController.getById);

router.patch('/:id/status',protect,authorizeRoles('ADMIN'),waitlistController.updateStatus);

router.delete('/:id',protect,authorizeRoles('ADMIN'),waitlistController.remove);

export default router;