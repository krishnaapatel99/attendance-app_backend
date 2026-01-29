// src/routes/authRoutes.js
import express from "express";
import { handleLogin, logout, validateUser, refreshAccessToken } from "../controllers/authControllers.js";
import verifyToken from "../middlewares/authMiddleware.js";
import {verifyForgotPasswordOtpMiddleware} from "../middlewares/verifyForgotPasswordOtpmiddleware.js";
import { resetPasswordAfterForgotPassword } from "../controllers/resetPasswordAfterForgotPassword.js";
const router = express.Router();

router.post("/signIn", handleLogin);
router.post("/signOut", logout);
router.get("/validateUser", verifyToken, validateUser);
router.post("/refresh", refreshAccessToken);
router.post("/forgot-password/reset", verifyForgotPasswordOtpMiddleware, resetPasswordAfterForgotPassword);
export default router;
    