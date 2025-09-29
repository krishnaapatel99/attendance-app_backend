import express from "express";
import { 
  getTimetable, 
  getTodaySchedule, 
  getTeacherSubjects, 
  getSubjectTimetable 
} from "../controllers/timetableController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public timetable route (accessible to both students and teachers)
router.get("/", verifyToken, getTimetable);
router.get("/today", verifyToken, getTodaySchedule);

// Teacher specific routes
router.get("/teacher/subjects", verifyToken, getTeacherSubjects);
router.get("/teacher/subject-schedule", verifyToken, getSubjectTimetable);

export default router;