import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import csrf from "csurf";
import dotenv from "dotenv";

import authRoutes from "./src/routes/authRoutes.js";
import teacherRoutes from "./src/routes/teacherRoutes.js";
import studentRoutes from "./src/routes/studentRoutes.js";
import timetableRoutes from "./src/routes/timetableRoutes.js";
import insertDataRoutes from "./src/routes/insertDataRoutes.js";
import otpRoutes from "./src/routes/otpRoutes.js";
import chatbotRoutes from "./src/routes/chatbotRoutes.js";
import emailRoutes from "./src/routes/emailRoute.js";
import attendanceRoutes from './src/routes/attendance.js';
import initDB from "./src/db/init.js";
import { checkRedisHealth } from "./src/utils/redisSafe.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);


app.use(express.json());
app.use(cookieParser());


const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://www.upasthit.in",
  process.env.CLIENT_URL,
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, origin);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);


app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);


app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // React safe
      imgSrc: ["'self'", "data:"],
      connectSrc: [
        "'self'",
        "https://www.upasthit.in",
        process.env.CLIENT_URL,
      ],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  })
);


const csrfProtection = csrf({
  cookie: {
    key: "_csrf",
    httpOnly: false, // frontend must read
    secure: true,
    sameSite: "none",
    domain: ".upasthit.in",
  },
});


app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", async (req, res) => {
  const redisOk = await checkRedisHealth();
  if (!redisOk) {
    return res.status(503).json({ status: "not-ready" });
  }
  res.status(200).json({ status: "ready" });
});


app.get("/api/csrf-token", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});


// ROUTES


app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);

// ✅ CSRF — authenticated, state-changing routes
app.use("/api/student", csrfProtection, studentRoutes);
app.use("/api/teacher", csrfProtection, teacherRoutes);
app.use("/api/timetable", csrfProtection, timetableRoutes);
app.use("/api/insertData", csrfProtection, insertDataRoutes);
app.use("/api/email", csrfProtection, emailRoutes);
app.use("/api/chatbot", csrfProtection, chatbotRoutes);
app.use('/api/attendance', attendanceRoutes);

app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({
      success: false,
      message: "Invalid or missing CSRF token",
    });
  }
  next(err);
});

const PORT = process.env.PORT || 3000;

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

      console.log(`🌐 Backend URL: ${process.env.API_BASE_URL || `http://localhost:${PORT}`}`);

      console.log(`💻 Frontend URL: ${process.env.CLIENT_URL || "http://localhost:5173"}`);

      console.log(

  `🟢 Health check: ${

    process.env.API_BASE_URL

      ? `${process.env.API_BASE_URL}/health`

      : `http://localhost:${PORT}/health`

  }`

);

    });

  } catch (error) {

    console.error("❌ Failed to start server:", error);

    console.error("Stack trace:", error.stack);

    process.exit(1);

  }

}



startServer();

