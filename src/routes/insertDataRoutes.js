import express from "express";
import { upload } from "../middlewares/upload.js";
import { importStudentsFromCSV, importStudentBatchesFromCSV } from "../controllers/studentInsertData.js";

const router = express.Router();

router.post("/import-csv", upload.single("file"), importStudentsFromCSV);
router.post("/import-student-batches",upload.single("file"),importStudentBatchesFromCSV
);
export default router;
