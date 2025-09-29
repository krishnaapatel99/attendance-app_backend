import pool from "../config/database.js";

export const getTeacherProfile = async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Teachers only"
      });
    }

    const result = await pool.query(
      "SELECT name FROM teachers WHERE teacher_id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }

    res.json({ success: true, data: result.rows[0], name: result.rows[0].name });
  } catch (error) {
    console.error("Error fetching teacher name:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
