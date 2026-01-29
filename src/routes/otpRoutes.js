// src/routes/otpRoutes.js
import express from "express";
import { sendOtp, verifyOtp, resendOtp } from "../controllers/otpController.js";
import verifyToken from "../middlewares/authMiddleware.js";
import { sendForgotPasswordOtp, verifyForgotPasswordOtp, resendForgotPasswordOtp } from "../controllers/ForgotPassword.js";
const router = express.Router();

router.post("/send-otp", verifyToken, sendOtp);
router.post("/verify-otp", verifyToken, verifyOtp);
router.post("/resend-otp",verifyToken, resendOtp);
router.post("/forgot/send-otp", sendForgotPasswordOtp);
router.post("/forgot/verify-otp", verifyForgotPasswordOtp);
router.post("/forgot/resend-otp", resendForgotPasswordOtp);
export default router;
