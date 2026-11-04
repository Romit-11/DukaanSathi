import { Router } from "express";
import { login, register, getMe, logout } from "../controllers/authController.js";
import requireAuth from "../middleware/requireAuth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, getMe);
router.post("/logout", logout);

export default router;
