import { Router } from "express";
import { interpretVoiceCommand } from "../controllers/voiceController.js";

const router = Router();
router.post("/interpret", interpretVoiceCommand);
export default router;
