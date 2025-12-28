import express from "express";
import { 
  getTeacherDashboard, 
  markAttendance, 
  submitAttendance,
  getStudentsForAttendance,
  getAttendanceData
} from "../controllers/teacherAttendanceController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { requireTeacher } from "../middlewares/userMiddleware.js";
import { getTeacherProfile } from "../controllers/teacherHomeController.js";


const router = express.Router();

router.get("/dashboard", verifyToken, requireTeacher, getTeacherDashboard);
router.post("/attendance", verifyToken, requireTeacher, markAttendance);
router.post("/submit", verifyToken, requireTeacher, submitAttendance);
router.get("/students", verifyToken, requireTeacher, getStudentsForAttendance);
router.get("/attendance-data", verifyToken, requireTeacher, getAttendanceData);
router.get("/profile", verifyToken, requireTeacher, getTeacherProfile);
export default router;
