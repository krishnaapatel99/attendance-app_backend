import { sendGeneralEmail } from "../services/mailService.js";
import pool from "../config/database.js";

export const getStudentEmail = async (req, res) => {
  try {
    const { studentId } = req.body;

    const result = await pool.query(
      `SELECT email FROM students WHERE student_rollno = $1`,
      [studentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to get student email",
    });
  }
};

export const sendEmail = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { to, subject, message } = req.body;

    // ✅ respond immediately
    res.status(200).json({
      success: true,
      message: "Email is being sent",
    });

    // ✉️ send in background
    setImmediate(async () => {
      try {
        await sendGeneralEmail({
          to,
          subject,
          html: `
            <h2>From Teacher (${teacherId})</h2>
            <p>${message}</p>
          `,
        });

        console.log("Email sent to:", to);
      } catch (err) {
        console.error("Email error:", err);
      }
    });
  } catch (error) {
    console.error("SEND EMAIL ERROR:", error);

    // only hits if something fails BEFORE response
    return res.status(500).json({
      success: false,
      message: "Failed to send email",
    });
  }
};
