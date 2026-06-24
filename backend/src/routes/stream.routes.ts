import { Router } from "express";
import { startStream, streamHeartbeat } from "../controllers/stream.controller";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

router.post("/:cameraId/:quality/start", asyncHandler(startStream));
router.post("/:cameraId/:quality/heartbeat", asyncHandler(streamHeartbeat));

export default router;
