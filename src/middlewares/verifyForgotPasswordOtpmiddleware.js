import pool from "../config/database.js";
import bcrypt from "bcrypt";

export const verifyForgotPasswordOtpMiddleware = async (req, res, next) => {
  try {
    const { role, identifier, otp } = req.body;

    if (!role || !identifier || !otp) {
      return res.status(400).json({
        success: false,
        message: "Role, identifier and OTP are required"
      });
    }

    if (!["student", "teacher"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role"
      });
    }

    let userId;

    // Resolve userId
    if (role === "student") {
      const student = await pool.query(
        `SELECT student_rollno FROM students WHERE student_rollno = $1`,
        [identifier]
      );
      if (student.rows.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }
      userId = student.rows[0].student_rollno;
    } else {
      const teacher = await pool.query(
        `SELECT teacher_id FROM teachers WHERE email = $1`,
        [identifier]
      );
      if (teacher.rows.length === 0) {
        return res.status(404).json({ message: "Teacher not found" });
      }
      userId = teacher.rows[0].teacher_id;
    }

    // Fetch latest OTP
    const otpResult = await pool.query(
      `
      SELECT id, otp, expires_at
      FROM password_otps
      WHERE user_id = $1 AND role = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId, role]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "OTP not found"
      });
    }

    const otpRow = otpResult.rows[0];

    // Expiry check
    if (new Date() > new Date(otpRow.expires_at)) {
      await pool.query(
        `DELETE FROM password_otps WHERE id = $1`,
        [otpRow.id]
      );
      return res.status(400).json({
        success: false,
        message: "OTP expired"
      });
    }

    // OTP match
    const isValid = await bcrypt.compare(otp, otpRow.otp);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    // Single-use OTP
    await pool.query(
      `DELETE FROM password_otps WHERE id = $1`,
      [otpRow.id]
    );

    // Pass verified identity forward
    req.verifiedUser = {
      userId,
      role
    };

    next();

  } catch (error) {
    console.error("FORGOT PASSWORD OTP MIDDLEWARE ERROR >>>", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
