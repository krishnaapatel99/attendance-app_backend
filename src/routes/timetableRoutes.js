import express from "express";
import { 
 getStudentWeeklyTimetable,
 getTeacherWeeklyTimetable
} from "../controllers/timetableController.js";
import verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();


// Teacher specific routes
router.get("/student/weekly-timetable", verifyToken, getStudentWeeklyTimetable);
router.get("/teacher/weekly-timetable", verifyToken, getTeacherWeeklyTimetable);

export default router;