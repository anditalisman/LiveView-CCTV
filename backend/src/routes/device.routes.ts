import { Router } from "express";
import {
  createDevice,
  deleteDevice,
  getDevice,
  listDevices,
  updateDevice,
} from "../controllers/device.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(listDevices));
router.get("/:id", asyncHandler(getDevice));
router.post("/", requireRole("ADMIN"), asyncHandler(createDevice));
router.patch("/:id", requireRole("ADMIN"), asyncHandler(updateDevice));
router.delete("/:id", requireRole("ADMIN"), asyncHandler(deleteDevice));

export default router;
