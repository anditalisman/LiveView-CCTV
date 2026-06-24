import { Router } from "express";
import {
  createCamera,
  deleteCamera,
  getCamera,
  listCameras,
  listLocations,
  testCameraConnection,
  toggleCameraActive,
  updateCamera,
} from "../controllers/camera.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// Admin & Operator boleh melihat daftar kamera dan lokasi (untuk dashboard live view)
router.get("/", asyncHandler(listCameras));
router.get("/locations", asyncHandler(listLocations));
router.get("/:id", asyncHandler(getCamera));

// Hanya Admin yang boleh kelola kamera
router.post("/", requireRole("ADMIN"), asyncHandler(createCamera));
router.patch("/:id", requireRole("ADMIN"), asyncHandler(updateCamera));
router.patch("/:id/toggle-active", requireRole("ADMIN"), asyncHandler(toggleCameraActive));
router.delete("/:id", requireRole("ADMIN"), asyncHandler(deleteCamera));
router.post("/:id/test-connection", requireRole("ADMIN"), asyncHandler(testCameraConnection));

export default router;
