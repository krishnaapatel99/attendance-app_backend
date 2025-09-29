// src/routes/studentRoutes.js
import express from "express";
import { getStudentProfile } from "../controllers/studentHomeController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { requireStudent } from "../middlewares/userMiddleware.js";
import {
  getOverallAttendance,
  getMonthlyAttendance,
  getSubjectWiseAttendance,
  getMonthlySubjectWiseAttendance,
} from "../controllers/studentAttendanceController.js";

const router = express.Router();

// Remember: mounted at /api/student in index.js
router.get("/profile", verifyToken, requireStudent, getStudentProfile);
router.get("/attendance/overall", verifyToken, requireStudent, getOverallAttendance);
router.get("/attendance/monthly", verifyToken, requireStudent, getMonthlyAttendance);
router.get("/attendance/subject-wise", verifyToken, requireStudent, getSubjectWiseAttendance);
router.get("/attendance/monthly-subject-wise", verifyToken, requireStudent, getMonthlySubjectWiseAttendance);

export default router;
