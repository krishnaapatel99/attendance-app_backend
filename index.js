import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import authRoutes from "./src/routes/authRoutes.js";
import teacherRoutes from "./src/routes/teacherRoutes.js";
import studentRoutes from "./src/routes/studentRoutes.js";
import timetableRoutes from "./src/routes/timetableRoutes.js";
import initDB from "./src/db/init.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));

app.use("/api/auth", authRoutes);
app.use("/api/teacher", teacherRoutes);  // inside teacherRoutes, DO NOT start paths with /teacher
app.use("/api/student", studentRoutes);  // inside studentRoutes, DO NOT start paths with /student
app.use("/api/timetable", timetableRoutes);

const PORT = process.env.PORT || 3000;

// Initialize database and start server
async function startServer() {
  try {
    console.log("🚀 Starting server initialization...");
    
    // Initialize database with dummy data
    const dbInitialized = await initDB();
    
    if (!dbInitialized) {
      console.error("❌ Database initialization failed, but starting server anyway...");
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Frontend URL: ${process.env.CLIENT_URL || "http://localhost:5173"}`);
      console.log(`🔗 Server URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

startServer();
