
// controllers/authController.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";

export const handleLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Try students first
    let result = await pool.query(
      "SELECT student_rollno AS id, name, email, password, 'student' AS role FROM students WHERE email=$1",
      [email]
    );

    if (result.rows.length === 0) {
      result = await pool.query(
        "SELECT teacher_id AS id, name, email, password, 'teacher' AS role FROM teachers WHERE email=$1",
        [email]
      );
    }

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid password" });
    }

    // pack everything into JWT so no need to re-query later
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.json({
      success: true,
      message: "Login successful",
      accessToken: token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};





export const logout = async (_req, res) => {
     res.clearCookie("token").json({ success: true }); 
    }; 
     
     
export const validateUser = async (req, res) => { 
     res.json({ success: true, user: req.user }); };