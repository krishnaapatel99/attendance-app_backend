import express from "express";
import {getStudentEmail,sendEmail} from "../controllers/emailController.js";
import verifyToken from "../middlewares/authMiddleware.js";
import { requireTeacher } from "../middlewares/userMiddleware.js";
const router=express.Router();

router.post("/get-student-email",verifyToken,requireTeacher,getStudentEmail);
router.post("/send-email",verifyToken,requireTeacher,sendEmail);
export default router;