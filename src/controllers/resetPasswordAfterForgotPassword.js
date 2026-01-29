import pool from "../config/database.js";
import bcrypt from "bcrypt";

export const resetPasswordAfterForgotPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    const { userId, role } = req.verifiedUser;

    // Validations
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

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password + invalidate refresh tokens
    if (role === "student") {
      await pool.query(
        `
        UPDATE students
        SET password = $1,
            refresh_token_hash = NULL,
            refresh_token_expires = NULL
        WHERE student_rollno = $2
        `,
        [hashedPassword, userId]
      );
    } else {
      await pool.query(
        `
        UPDATE teachers
        SET password = $1,
            refresh_token_hash = NULL,
            refresh_token_expires = NULL
        WHERE teacher_id = $2
        `,
        [hashedPassword, userId]
      );
    }

    res.json({
      success: true,
      message: "Password reset successfully. Please login again."
    });

  } catch (error) {
    console.error("RESET PASSWORD ERROR >>>", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
