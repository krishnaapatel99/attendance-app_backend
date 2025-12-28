import pool from "../config/database.js";


const TIME_SLOTS = {
  1: "9:30-10:30",
  2: "10:30-11:30",
  3: "11:30-12:30",
  4: "1:00-2:00",
  5: "2:00-3:00",
  6: "3:00-4:00",
  7: "4:00-4:30"
};

export const getStudentWeeklyTimetable = async (req, res) => {
  try {
    const studentId = req.user.id;

 
    const studentRes = await pool.query(
      `SELECT class_id FROM students WHERE student_rollno = $1`,
      [studentId]
    );

    if (!studentRes.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    const classId = studentRes.rows[0].class_id;

    // 2️⃣ Get student's batch(es)
    const batchRes = await pool.query(
      `SELECT batch_id FROM student_batches WHERE student_rollno = $1`,
      [studentId]
    );

    const batchIds = batchRes.rows.map(b => b.batch_id);

    // 3️⃣ Fetch timetable entries
    const result = await pool.query(
      `SELECT
        t.day_of_week,
        t.lecture_no,
        t.lecture_type,
        s.subject_name,
        tc.name AS teacher_name,
        b.batch_name
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.subject_id
      JOIN teachers tc ON t.teacher_id = tc.teacher_id
      LEFT JOIN batches b ON t.batch_id = b.batch_id
      WHERE
        t.class_id = $1
        AND (
          t.lecture_type = 'LECTURE'
          OR (
            t.lecture_type = 'PRACTICAL'
            AND t.batch_id = ANY($2::int[])
          )
        )
      ORDER BY
        CASE
          WHEN t.day_of_week = 'Monday' THEN 1
          WHEN t.day_of_week = 'Tuesday' THEN 2
          WHEN t.day_of_week = 'Wednesday' THEN 3
          WHEN t.day_of_week = 'Thursday' THEN 4
          WHEN t.day_of_week = 'Friday' THEN 5
          WHEN t.day_of_week = 'Saturday' THEN 6
        END,
        t.lecture_no`,
      [classId, batchIds]
    );


    const timetable = {};

    result.rows.forEach(row => {
      if (!timetable[row.day_of_week]) {
        timetable[row.day_of_week] = {};
      }

      timetable[row.day_of_week][row.lecture_no] = {
        subject: row.subject_name,
        type: row.lecture_type,
        teacher: row.teacher_name,
        batch: row.lecture_type === "PRACTICAL" ? row.batch_name : null,
        time: TIME_SLOTS[row.lecture_no]
      };
    });

    res.json({
      success: true,
      role: "student",
      timetable,
      timeSlots: TIME_SLOTS
    });

  } catch (error) {
    console.error("Student timetable error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};


export const getTeacherWeeklyTimetable = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const result = await pool.query(
      `SELECT
        t.day_of_week,
        t.lecture_no,
        t.lecture_type,
        s.subject_name,
        c.year,
        c.branch,
        b.batch_name
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.subject_id
      JOIN classes c ON t.class_id = c.class_id
      LEFT JOIN batches b ON t.batch_id = b.batch_id
      WHERE t.teacher_id = $1
      ORDER BY
        CASE
          WHEN t.day_of_week = 'Monday' THEN 1
          WHEN t.day_of_week = 'Tuesday' THEN 2
          WHEN t.day_of_week = 'Wednesday' THEN 3
          WHEN t.day_of_week = 'Thursday' THEN 4
          WHEN t.day_of_week = 'Friday' THEN 5
          WHEN t.day_of_week = 'Saturday' THEN 6
        END,
        t.lecture_no`,
      [teacherId]
    );

    const timetable = {};

    result.rows.forEach(row => {
      if (!timetable[row.day_of_week]) {
        timetable[row.day_of_week] = {};
      }

      timetable[row.day_of_week][row.lecture_no] = {
        subject: row.subject_name,
        type: row.lecture_type,
        class: `${row.year} ${row.branch}`,
        batch: row.lecture_type === "PRACTICAL" ? row.batch_name : null,
        time: TIME_SLOTS[row.lecture_no]
      };
    });

    res.json({
      success: true,
      role: "teacher",
      timetable,
      timeSlots: TIME_SLOTS
    });

  } catch (error) {
    console.error("Teacher timetable error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
