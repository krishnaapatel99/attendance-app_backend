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
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow localhost and your hosted frontend
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://attendance-app1-three.vercel.app', // Remove trailing slash
      // Add more domains as needed
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // For development, you might want to allow all origins
    // return callback(null, true);
    
    // Log the rejected origin for debugging
    console.log(`❌ CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Enable credentials for secure authentication
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'Attendance App Backend is running'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Attendance App API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      teacher: '/api/teacher',
      student: '/api/student',
      timetable: '/api/timetable'
    }
  });
});


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
      console.log(`🌐 Backend URL: ${process.env.NODE_ENV === 'production' ? 'https://attendance-app-backend-4.onrender.com' : `http://localhost:${PORT}`}`);
      console.log(`💻 Frontend URL: ${process.env.CLIENT_URL || "http://localhost:5173"}`);
      console.log(`🟢 Health check: ${process.env.NODE_ENV === 'production' ? 'https://attendance-app-backend-3mi7.onrender.com/health' : `http://localhost:${PORT}/health`}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

startServer();
