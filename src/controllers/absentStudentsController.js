import pool from "../config/database.js";

export const getAbsentStudentsForUpdate = async (req, res) => {
  const { timetable_id, attendance_date } = req.query;

  try {
    const result = await pool.query(
      `
      SELECT 
        a.attendance_id,
        a.student_rollno,
        s.name
      FROM attendance a
      JOIN students s 
        ON s.student_rollno = a.student_rollno
      WHERE a.timetable_id = $1
        AND a.attendance_date = $2
        AND a.status = 'Absent'
        AND a.submitted = true
      ORDER BY s.student_rollno
      `,
      [timetable_id, attendance_date]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

export const updateSubmittedAttendance = async (req, res) => {
  const { timetable_id, attendance_date, present_students } = req.body;
  // present_students = ["SEA127", "SEA130"]

  if (!Array.isArray(present_students) || present_students.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No students selected"
    });
  }

  try {
    await pool.query(
      `
      UPDATE attendance
      SET status = 'Present',
          updated_at = CURRENT_TIMESTAMP
      WHERE timetable_id = $1
        AND attendance_date = $2
        AND student_rollno = ANY($3::text[])
        AND submitted = true
      `,
      [timetable_id, attendance_date, present_students]
    );

    res.json({
      success: true,
      message: "Attendance updated successfully"
    });

  } catch (err) {
    console.error("UPDATE ERROR >>>", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
