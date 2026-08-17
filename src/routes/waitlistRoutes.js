import express from "express";
import waitlistController from "../controllers/waitlistController.js";

const router = express.Router();

router.post("/", waitlistController.create);
router.get("/", waitlistController.getAll);

export default router;