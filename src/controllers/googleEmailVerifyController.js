// controllers/googleEmailVerifyController.js
import { OAuth2Client } from "google-auth-library";
import pool from "../config/database.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const verifyEmailWithGoogle = async (req, res) => {
  const studentId = req.user.id;
  const { idToken } = req.body;

  try {
    // 🔍 Check existing email status
    const existing = await pool.query(
      `SELECT email, email_verified
       FROM students
       WHERE student_rollno = $1`,
      [studentId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
const emailCheck = await pool.query(
  `SELECT 1 FROM students WHERE email = $1 AND student_rollno != $2`,
  [email, studentId]
);

if (emailCheck.rows.length > 0) {
  return res.status(409).json({
    success: false,
    message: "This email is already associated with another account"
  });
}

    if (existing.rows[0].email_verified) {
      return res.status(409).json({
        success: false,
        message: "Email already verified. Cannot overwrite."
      });
    }

    // 🔐 Verify Google token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = payload.email;

    if (!payload.email_verified) {
      return res.status(400).json({
        success: false,
        message: "Google email not verified"
      });
    }

    // 📝 Save email
    await pool.query(
      `UPDATE students
       SET email = $1,
           email_verified = true
       WHERE student_rollno = $2`,
      [email, studentId]
    );

    res.json({
      success: true,
      email,
      message: "Email verified successfully"
    });

  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid Google token"
    });
  }
};

