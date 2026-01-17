// controllers/authController.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import pool from "../config/database.js";


const isProd=process.env.NODE_ENV === "production";
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const generateAccessToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

const generateRefreshToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );



export const handleLogin = async (req, res) => {
  const { email, password } = req.body; 

  try {
    
    let result = await pool.query(
      `SELECT student_rollno AS id, name, password, 'student' AS role
       FROM students
       WHERE student_rollno = $1`,
      [email]
    );

    
    if (result.rows.length === 0) {
      result = await pool.query(
        `SELECT teacher_id AS id, name, email, password, 'teacher' AS role
         FROM teachers
         WHERE email = $1`,
        [email]
      );
    }

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const user = result.rows[0];

    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshHash = hashToken(refreshToken);

    if (user.role === "student") {
      await pool.query(
        `UPDATE students
         SET refresh_token_hash = $1,
             refresh_token_expires = NOW() + INTERVAL '7 days'
         WHERE student_rollno = $2`,
        [refreshHash, user.id]
      );
    } else {
      await pool.query(
        `UPDATE teachers
         SET refresh_token_hash = $1,
             refresh_token_expires = NOW() + INTERVAL '7 days'
         WHERE teacher_id = $2`,
        [refreshHash, user.id]
      );
    }

    
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
      maxAge: 15 * 60 * 1000, // 15 min
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    
    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const refreshAccessToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ success: false });
  }

  try {
    
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    if (!["student", "teacher"].includes(decoded.role)) {
      return res.status(401).json({ success: false });
    }

    const refreshHash = hashToken(refreshToken);

    const table = decoded.role === "student" ? "students" : "teachers";
    const idColumn =
      decoded.role === "student" ? "student_rollno" : "teacher_id";

    
    const result = await pool.query(
      `SELECT refresh_token_hash, refresh_token_expires
       FROM ${table}
       WHERE ${idColumn} = $1`,
      [decoded.id]
    );

    if (
      result.rows.length === 0 ||
      result.rows[0].refresh_token_hash !== refreshHash ||
      result.rows[0].refresh_token_expires < new Date()
    ) {
      return res.status(401).json({ success: false });
    }

    
    const newAccessToken = generateAccessToken({
      id: decoded.id,
      role: decoded.role,
    });

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
      maxAge: 15 * 60 * 1000,
    });

    res.json({ success: true });
  } catch (error) {
    return res.status(401).json({ success: false });
  }
};


export const logout = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET
      );

      const table =
        decoded.role === "student" ? "students" : "teachers";
      const idColumn =
        decoded.role === "student" ? "student_rollno" : "teacher_id";

      await pool.query(
        `UPDATE ${table}
         SET refresh_token_hash = NULL,
             refresh_token_expires = NULL
         WHERE ${idColumn} = $1`,
        [decoded.id]
      );
    } catch {
      
    }
  }

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });

  res.json({ success: true });
};


export const validateUser = async (req, res) => {
  try {
    
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Optionally, you can fetch fresh user data from the database
    let user;
    if (req.user.role === 'student') {
      const result = await pool.query(
        'SELECT student_rollno AS id, name, email FROM students WHERE student_rollno = $1',
        [req.user.id]
      );
      user = result.rows[0];
    } else {
      const result = await pool.query(
        'SELECT teacher_id AS id, name, email FROM teachers WHERE teacher_id = $1',
        [req.user.id]
      );
      user = result.rows[0];
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ 
      success: true,
      user: {
        ...user,
        role: req.user.role
      }
    });
  } catch (error) {
    console.error("Validation error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};