import express from "express";
import { upload } from "../middlewares/upload.js";
import { importStudentsFromCSV } from "../controllers/studentInsertData.js";

const router = express.Router();

router.post("/import-csv", upload.single("file"), importStudentsFromCSV);

export default router;
