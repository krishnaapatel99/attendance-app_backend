import pool from "../config/database.js";

//Show data and rows of students 

export const getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const today = new Date().toLocaleString("en-US", {
      weekday: "long",
      timeZone: "Asia/Kolkata"
    });

    const result = await pool.query(
      `
      SELECT 
        t.timetable_id,
        t.lecture_no,
        t.lecture_type,
        s.subject_name,
        c.year,
        c.branch,
        b.batch_name,
        t.academic_year
      FROM timetable t
      JOIN subjects s ON s.subject_id = t.subject_id
      JOIN classes c ON c.class_id = t.class_id
      LEFT JOIN batches b ON b.batch_id = t.batch_id
      WHERE t.teacher_id = $1
        AND t.day_of_week = $2
      ORDER BY t.lecture_no
      `,
      [teacherId, today]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



// Get students list for attendance marking with current timetable context
export const getStudentsForAttendance = async (req, res) => {
  try {
    const { timetable_id } = req.query;

    // Get timetable context
    const tt = await pool.query(
      `
      SELECT lecture_type, class_id, batch_id
      FROM timetable
      WHERE timetable_id = $1
      `,
      [timetable_id]
    );

    if (!tt.rows.length) {
      return res.status(404).json({ success: false, message: "Lecture not found" });
    }

    const { lecture_type, class_id, batch_id } = tt.rows[0];

    let studentsQuery;
    let params;

    // LECTURE → whole class
    if (lecture_type === "LECTURE") {
      studentsQuery = `
        SELECT student_rollno, name
        FROM students
        WHERE class_id = $1
        ORDER BY student_rollno
      `;
      params = [class_id];
    }

    // PRACTICAL → batch students only
    else {
      studentsQuery = `
        SELECT s.student_rollno, s.name
        FROM students s
        JOIN student_batches sb ON sb.student_rollno = s.student_rollno
        WHERE sb.batch_id = $1
        ORDER BY s.student_rollno
      `;
      params = [batch_id];
    }

    const students = await pool.query(studentsQuery, params);

    res.json({
      success: true,
      data: students.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Get attendance data for a specific date and class
export const getAttendanceData = async (req, res) => {
  try {
    const { timetable_id, attendance_date } = req.query;

    // get lecture context
    const tt = await pool.query(
      `
      SELECT lecture_type, class_id, batch_id
      FROM timetable
      WHERE timetable_id = $1
      `,
      [timetable_id]
    );

    if (!tt.rows.length) {
      return res.status(404).json({ success: false });
    }

    const { lecture_type, class_id, batch_id } = tt.rows[0];

    let query;
    let params;

    // LECTURE → whole class
    if (lecture_type === "LECTURE") {
      query = `
        SELECT 
          s.student_rollno,
          s.name,
          a.status,
          a.submitted,
          a.attendance_id
        FROM students s
        LEFT JOIN attendance a 
          ON a.student_rollno = s.student_rollno
          AND a.timetable_id = $1
          AND a.attendance_date = $2
        WHERE s.class_id = $3
        ORDER BY s.student_rollno
      `;
      params = [timetable_id, attendance_date, class_id];
    }
    // PRACTICAL → batch students
    else {
      query = `
        SELECT 
          s.student_rollno,
          s.name,
          a.status,
          a.submitted,
          a.attendance_id
        FROM students s
        JOIN student_batches sb ON sb.student_rollno = s.student_rollno
        LEFT JOIN attendance a 
          ON a.student_rollno = s.student_rollno
          AND a.timetable_id = $1
          AND a.attendance_date = $2
        WHERE sb.batch_id = $3
        ORDER BY s.student_rollno
      `;
      params = [timetable_id, attendance_date, batch_id];
    }

    const result = await pool.query(query, params);

    res.json({ success: true, data: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};



                 // Mark attendance for a student 
                 

// Mark or update attendance (before submission)
export const markAttendance = async (req, res) => {
  const { student_rollno, timetable_id, status, attendance_date } = req.body;

  try {
    const existing = await pool.query(
      `
      SELECT attendance_id, submitted
      FROM attendance
      WHERE student_rollno = $1
        AND timetable_id = $2
        AND attendance_date = $3
      `,
      [student_rollno, timetable_id, attendance_date]
    );

    if (existing.rows.length) {
      if (existing.rows[0].submitted) {
        return res.status(400).json({
          success: false,
          message: "Attendance already submitted"
        });
      }

      await pool.query(
        `
        UPDATE attendance
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE attendance_id = $2
        `,
        [status, existing.rows[0].attendance_id]
      );
    } else {
      await pool.query(
        `
        INSERT INTO attendance 
        (student_rollno, timetable_id, status, attendance_date)
        VALUES ($1, $2, $3, $4)
        `,
        [student_rollno, timetable_id, status, attendance_date]
      );
    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};


// Submit (lock) attendance for a subject and timetable slot
export const submitAttendance = async (req, res) => {
  const { timetable_id, attendance_date } = req.body;

  try {
    const tt = await pool.query(
      `
      SELECT lecture_type, class_id, batch_id
      FROM timetable
      WHERE timetable_id = $1
      `,
      [timetable_id]
    );

    const { lecture_type, class_id, batch_id } = tt.rows[0];

    let insertQuery;
    let params;

    if (lecture_type === "LECTURE") {
      insertQuery = `
        INSERT INTO attendance (student_rollno, timetable_id, status, attendance_date)
        SELECT s.student_rollno, $1, 'Present', $2
        FROM students s
        WHERE s.class_id = $3
        AND NOT EXISTS (
          SELECT 1 FROM attendance a
          WHERE a.student_rollno = s.student_rollno
            AND a.timetable_id = $1
            AND a.attendance_date = $2
        )
      `;
      params = [timetable_id, attendance_date, class_id];
    } else {
      insertQuery = `
        INSERT INTO attendance (student_rollno, timetable_id, status, attendance_date)
        SELECT s.student_rollno, $1, 'Present', $2
        FROM students s
        JOIN student_batches sb ON sb.student_rollno = s.student_rollno
        WHERE sb.batch_id = $3
        AND NOT EXISTS (
          SELECT 1 FROM attendance a
          WHERE a.student_rollno = s.student_rollno
            AND a.timetable_id = $1
            AND a.attendance_date = $2
        )
      `;
      params = [timetable_id, attendance_date, batch_id];
    }

    await pool.query(insertQuery, params);

    await pool.query(
      `
      UPDATE attendance
      SET submitted = true
      WHERE timetable_id = $1
        AND attendance_date = $2
      `,
      [timetable_id, attendance_date]
    );

    res.json({ success: true, message: "Attendance locked" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};
