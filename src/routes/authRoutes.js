// src/routes/authRoutes.js
import express from "express";
import { handleLogin, logout, validateUser, refreshAccessToken } from "../controllers/authControllers.js";
import verifyToken from "../middlewares/authMiddleware.js";
const router = express.Router();

router.post("/signIn", handleLogin);
router.post("/signOut", logout);
router.get("/validateUser", verifyToken, validateUser);
router.post("/refresh", refreshAccessToken);
export default router;
    