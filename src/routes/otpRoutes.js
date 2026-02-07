// src/routes/otpRoutes.js
import express from "express";
import { sendForgotPasswordOtp, verifyForgotPasswordOtp, resendForgotPasswordOtp } from "../controllers/ForgotPassword.js";
const router = express.Router();


router.post("/forgot/send-otp", sendForgotPasswordOtp);
router.post("/forgot/verify-otp", verifyForgotPasswordOtp);
router.post("/forgot/resend-otp", resendForgotPasswordOtp);
export default router;
