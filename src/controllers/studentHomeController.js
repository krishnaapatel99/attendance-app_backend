import pool from "../config/database.js";

export const getStudentProfile = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Students only"
      });
    }

    const result = await pool.query(
      "SELECT name FROM students WHERE student_rollno = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.json({ success: true, name: result.rows[0].name });
  } catch (error) {
    console.error("Error fetching student name:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
