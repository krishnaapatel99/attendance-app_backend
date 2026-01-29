import pool from "../config/database.js";
import bcrypt from "bcrypt";

export const getNewPassword = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { newPassword, confirmPassword } = req.body;

    // 1️⃣ Basic validations
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Both password fields are required"
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    // 2️⃣ Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 3️⃣ Update password in DB
    const result = await pool.query(
      `
      UPDATE students
      SET password = $1
      WHERE student_rollno = $2
      `,
      [hashedPassword, studentId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    res.json({
      success: true,
      message: "Password updated successfully"
    });

  } catch (error) {
    console.error("PASSWORD UPDATE ERROR >>>", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
