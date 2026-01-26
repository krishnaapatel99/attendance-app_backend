import pool from "../config/database.js";
import { generateOtp } from "../utils/generateOtp.js";
import { transporter } from "../config/mail.js";

const OTP_EXPIRY_MIN = 5;
const MAX_OTP_ATTEMPTS = 5;
const MAX_RESENDS = 3;
const RESEND_COOLDOWN_SEC = 60;

export const sendOtp = async (req, res) => {
 try {
   const studentId = req.user.id; // from JWT middleware
  
  const { email } = req.body;
const emailExists = await pool.query(
  `SELECT 1 
   FROM students 
   WHERE email = $1 AND student_rollno != $2`,
  [email, studentId]
);

if (emailExists.rows.length > 0) {
  return res.status(409).json({
    success: false,
    message: "This email is already associated with another account",
  });
}
  // Attach email to existing user (unverified)
  await pool.query(
    `UPDATE students
     SET email = $1, email_verified = false
     WHERE student_rollno = $2`,
    [email, studentId]
  );

  // Remove old OTPs for this user
  await pool.query(
    "DELETE FROM email_otps WHERE student_rollno = $1",
    [studentId]
  );

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);

  await pool.query(
    `INSERT INTO email_otps (student_rollno, email, otp, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [studentId, email, otp, expiresAt]
  );

  await transporter.sendMail({
    from: `"Upasthit" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your OTP",
    html: `<h2>Your OTP is ${otp}</h2>`
  });

  res.json({ message: "OTP sent" ,
    success: true,
  });
 } catch (err) {
    console.error("🔥 SEND OTP ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};



export const verifyOtp = async (req, res) => {
  const studentId = req.user.id;
  const { otp } = req.body;

  const result = await pool.query(
    "SELECT * FROM email_otps WHERE student_rollno = $1",
    [studentId]
  );

  if (result.rows.length === 0) {
    return res.status(400).json({ message: "OTP not found" });
  }

  const record = result.rows[0];

  // ⏰ Expiry check
  if (new Date(record.expires_at) < new Date()) {
    await pool.query(
      "DELETE FROM email_otps WHERE student_rollno = $1",
      [studentId]
    );
    return res.status(400).json({ message: "OTP expired" });
  }

  // 🔑 OTP comparison (FIX)
  if (String(record.otp) !== String(otp)) {
    const updated = await pool.query(
      `UPDATE email_otps
       SET attempts = attempts + 1
       WHERE student_rollno = $1
       RETURNING attempts`,
      [studentId]
    );

    if (updated.rows[0].attempts >= MAX_OTP_ATTEMPTS) {
      await pool.query(
        "DELETE FROM email_otps WHERE student_rollno = $1",
        [studentId]
      );
      return res.status(429).json({
        message: "Too many wrong attempts. Request new OTP."
      });
    }

    return res.status(400).json({ message: "Invalid OTP" });
  }

  // ✅ Correct OTP
  await pool.query(
    "UPDATE students SET email_verified = true WHERE student_rollno = $1",
    [studentId]
  );

  await pool.query(
    "DELETE FROM email_otps WHERE student_rollno = $1",
    [studentId]
  );

  res.json({ message: "Email verified successfully" });
};



export const resendOtp = async (req, res) => {
  const studentId = req.user.id;

  const otpResult = await pool.query(
    "SELECT * FROM email_otps WHERE student_rollno = $1",
    [studentId]
  );

  if (otpResult.rows.length === 0) {
    return res.status(400).json({ message: "OTP not found" });
  }

  const otpData = otpResult.rows[0];

  if (otpData.resend_count >= MAX_RESENDS) {
    await pool.query("DELETE FROM email_otps WHERE student_rollno = $1", [studentId]);
    return res.status(429).json({
      message: "Resend limit exceeded. Request new OTP."
    });
  }

  const diff =
    (Date.now() - new Date(otpData.created_at)) / 1000;

  if (diff < RESEND_COOLDOWN_SEC) {
    return res.status(429).json({
      message: "Please wait before resending OTP"
    });
  }

  const newOtp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);

  await pool.query(
    `UPDATE email_otps
     SET otp = $1,
         expires_at = $2,
         resend_count = resend_count + 1,
         attempts = 0,
         created_at = NOW()
     WHERE student_rollno = $3`,
    [newOtp, expiresAt, studentId]
  );

  await transporter.sendMail({
    to: otpData.email,
    subject: "Your New OTP",
    html: `<h2>Your new OTP is ${newOtp}</h2>`
  });

  res.json({ message: "OTP resent successfully" });
};

