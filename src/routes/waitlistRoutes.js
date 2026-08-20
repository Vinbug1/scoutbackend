import express from "express";
import waitlistController from "../controllers/waitlistController.js";
import { verifyToken as authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.post("/", waitlistController.create);
router.get("/", authorizeRoles('ADMIN'),waitlistController.getAll);

export default router;