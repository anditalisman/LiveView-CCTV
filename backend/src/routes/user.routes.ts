import { Router } from "express";
import { createUser, deleteUser, listUsers, updateUser } from "../controllers/user.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate, requireRole("ADMIN"));

router.get("/", asyncHandler(listUsers));
router.post("/", asyncHandler(createUser));
router.patch("/:id", asyncHandler(updateUser));
router.delete("/:id", asyncHandler(deleteUser));

export default router;
