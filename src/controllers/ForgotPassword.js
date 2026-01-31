import pool from "../config/database.js";
import bcrypt from "bcrypt";
import { sendOtpEmail } from "../services/mailService.js";
import {generateOtp} from "../utils/generateOtp.js";

export const sendForgotPasswordOtp = async (req, res) => {
  const { role, identifier } = req.body;
 

  if (!role || !identifier) {
    return res.status(400).json({
      success: false,
      message: "Role and identifier are required"
    });
  }

  try {
    let email;
    let userId; // rollno or teacher_id (for OTP table reference)

    // 1️⃣ Fetch email based on role
    if (role === "student") {
      const result = await pool.query(
        `SELECT student_rollno, email FROM students WHERE student_rollno = $1`,
        [identifier]
      );

      if (result.rows.length === 0 || !result.rows[0].email) {
        return res.status(404).json({
          success: false,
          message: "Student not found or email not registered"
        });
      }

      email = result.rows[0].email;
      userId = result.rows[0].student_rollno;

    } else if (role === "teacher") {
      const result = await pool.query(
        `SELECT teacher_id, email FROM teachers WHERE email = $1`,
        [identifier]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found"
        });
      }

      email = result.rows[0].email;
      userId = result.rows[0].teacher_id;

    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid role"
      });
    }

    // 2️⃣ Generate & hash OTP
    const otp = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // 3️⃣ Remove old OTPs for this user
    await pool.query(
      `DELETE FROM password_otps WHERE user_id = $1 AND role = $2`,
      [userId, role]
    );

    // 4️⃣ Store new OTP
    await pool.query(
      `
      INSERT INTO password_otps (user_id, role, otp, expires_at)
      VALUES ($1, $2, $3, $4)
      `,
      [userId, role, hashedOtp, expiresAt]
    );
 res.json({
      success: true,
      message: "OTP sent successfully"
    });

    // 5️⃣ Send OTP email
setImmediate(async () => {
  try {
    await sendOtpEmail({
      to: email,
      otp,
      purpose: "FORGOT_PASSWORD",
    });
    console.log("Forgot password OTP sent");
  } catch (err) {
    console.error("Forgot OTP mail error:", err);
  }
});


   
  } catch (error) {
    console.error("FORGOT PASSWORD OTP ERROR >>>", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP"
    });
  }
};



export const verifyForgotPasswordOtp = async (req, res) => {
  const { role, identifier, otp } = req.body;
  // role: "student" | "teacher"
  // identifier: rollno OR email

  if (!role || !identifier || !otp) {
    return res.status(400).json({
      success: false,
      message: "All fields are required"
    });
  }

  try {
    let userId;

    // 1️⃣ Resolve userId
    if (role === "student") {
      const student = await pool.query(
        `SELECT student_rollno FROM students WHERE student_rollno = $1`,
        [identifier]
      );

      if (student.rows.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }

      userId = student.rows[0].student_rollno;

    } else if (role === "teacher") {
      const teacher = await pool.query(
        `SELECT teacher_id FROM teachers WHERE email = $1`,
        [identifier]
      );

      if (teacher.rows.length === 0) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      userId = teacher.rows[0].teacher_id;

    } else {
      return res.status(400).json({ message: "Invalid role" });
    }

    // 2️⃣ Get latest OTP
    const otpResult = await pool.query(
      `
      SELECT otp, expires_at
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
        message: "OTP not found. Please resend OTP."
      });
    }

    const { otp: hashedOtp, expires_at } = otpResult.rows[0];

    // 3️⃣ Check expiry
    if (new Date() > new Date(expires_at)) {
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please resend OTP."
      });
    }

    // 4️⃣ Compare OTP
    const isValid = await bcrypt.compare(otp, hashedOtp);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    res.json({
      success: true,
      message: "OTP verified successfully"
    });

  } catch (error) {
    console.error("VERIFY OTP ERROR >>>", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP"
    });
  }
};

export const resendForgotPasswordOtp = async (req, res) => {
  const { role, identifier } = req.body;

  if (!role || !identifier) {
    return res.status(400).json({
      success: false,
      message: "Role and identifier are required",
    });
  }

  try {
    let email;
    let userId;

    // 1️⃣ Resolve user
    if (role === "student") {
      const student = await pool.query(
        `SELECT student_rollno, email FROM students WHERE student_rollno = $1`,
        [identifier]
      );

      if (student.rows.length === 0 || !student.rows[0].email) {
        return res
          .status(404)
          .json({ message: "Student not found or email missing" });
      }

      userId = student.rows[0].student_rollno;
      email = student.rows[0].email;
    } else if (role === "teacher") {
      const teacher = await pool.query(
        `SELECT teacher_id, email FROM teachers WHERE email = $1`,
        [identifier]
      );

      if (teacher.rows.length === 0) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      userId = teacher.rows[0].teacher_id;
      email = teacher.rows[0].email;
    } else {
      return res.status(400).json({ message: "Invalid role" });
    }

    // 2️⃣ Generate OTP
    const otp = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // 3️⃣ Delete old OTP
    await pool.query(
      `DELETE FROM password_otps WHERE user_id = $1 AND role = $2`,
      [userId, role]
    );

    // 4️⃣ Save new OTP
    await pool.query(
      `
      INSERT INTO password_otps (user_id, role, otp, expires_at)
      VALUES ($1, $2, $3, $4)
      `,
      [userId, role, hashedOtp, expiresAt]
    );

    // ✅ Respond immediately
    res.json({
      success: true,
      message: "OTP resent successfully",
    });

    // 5️⃣ Send OTP email (background)
    setImmediate(async () => {
      try {
        await sendOtpEmail({
          to: email,
          otp,
          purpose: "FORGOT_PASSWORD",
        });

        console.log("Resent forgot password OTP sent");
      } catch (err) {
        console.error("Resend forgot OTP mail error:", err);
      }
    });
  } catch (error) {
    console.error("RESEND OTP ERROR >>>", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP",
    });
  }
};
