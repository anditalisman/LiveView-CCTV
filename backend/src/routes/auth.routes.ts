import { Router } from "express";
import { changePassword, login, me } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/login", asyncHandler(login));
router.get("/me", authenticate, asyncHandler(me));
router.post("/change-password", authenticate, asyncHandler(changePassword));

export default router;
