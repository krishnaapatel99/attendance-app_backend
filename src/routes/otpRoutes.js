// src/routes/otpRoutes.js
import express from "express";
import { sendOtp, verifyOtp, resendOtp } from "../controllers/otpController.js";
import verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/send-otp", verifyToken, sendOtp);
router.post("/verify-otp", verifyToken, verifyOtp);
router.post("/resend-otp",verifyToken, resendOtp);

export default router;
