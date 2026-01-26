import express from "express";
import { 
  getTeacherDashboard, 
  markAttendance, 
  submitAttendance,
  getStudentsForAttendance,
  getAttendanceData
} from "../controllers/teacherAttendanceController.js";
import verifyToken  from "../middlewares/authMiddleware.js";
import { requireTeacher } from "../middlewares/userMiddleware.js";
import { getTeacherProfile } from "../controllers/teacherHomeController.js";
import { getAttendanceSummary, getAttendanceCalendar, getTeacherLectureTypeSubjects, getTeacherClassesForSubjectType, getTeacherBatchesForSubjectClass, getCurrentLectureForTeacher } from "../controllers/teacherViewAttendanceController.js";


const router = express.Router();

router.get("/dashboard", verifyToken, requireTeacher, getTeacherDashboard);
router.post("/attendance", verifyToken, requireTeacher, markAttendance);
router.post("/submit", verifyToken, requireTeacher, submitAttendance);
router.get("/students", verifyToken, requireTeacher, getStudentsForAttendance);
router.get("/attendance-data", verifyToken, requireTeacher, getAttendanceData);
router.get("/profile", verifyToken, requireTeacher, getTeacherProfile);
router.get("/current-lecture", verifyToken, requireTeacher, getCurrentLectureForTeacher);
router.get("/lecture-type-subjects", verifyToken, requireTeacher, getTeacherLectureTypeSubjects);
router.get("/classes-for-subject-type", verifyToken, requireTeacher, getTeacherClassesForSubjectType);
router.get("/batches-for-subject-class", verifyToken, requireTeacher, getTeacherBatchesForSubjectClass);
router.get("/attendance-summary", verifyToken, requireTeacher, getAttendanceSummary);
router.get("/attendance-calendar", verifyToken, requireTeacher, getAttendanceCalendar);
export default router;
