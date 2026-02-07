
import express from "express";
import { getStudentProfile } from "../controllers/studentHomeController.js";
import verifyToken from "../middlewares/authMiddleware.js";
import { requireStudent } from "../middlewares/userMiddleware.js";
import {
  getOverallAttendance,
  getMonthlyAttendance,
  getSubjectWiseAttendance,
  // getMonthlySubjectWiseAttendance,
} from "../controllers/studentAttendanceController.js";
import {getNewPassword} from "../controllers/passwordController.js";
import { sendOtp, verifyOtp, resendOtp } from "../controllers/otpController.js";

const router = express.Router();

router.post("/send-otp", verifyToken, sendOtp);
router.post("/verify-otp", verifyToken, verifyOtp);
router.post("/resend-otp",verifyToken, resendOtp);
router.get("/profile", verifyToken, requireStudent, getStudentProfile);
router.get("/attendance/overall", verifyToken, requireStudent, getOverallAttendance);
router.get("/attendance/monthly", verifyToken, requireStudent, getMonthlyAttendance);
router.get("/attendance/subject-wise", verifyToken, requireStudent, getSubjectWiseAttendance);
router.post("/change-password",verifyToken,requireStudent,getNewPassword)
// router.get("/attendance/monthly-subject-wise", verifyToken, requireStudent, getMonthlySubjectWiseAttendance);

export default router;
