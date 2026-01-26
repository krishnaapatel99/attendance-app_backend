import pool from "../config/database.js";

const TIME_SLOTS = {
  1: { start: "09:30", end: "10:30" },
  2: { start: "10:30", end: "11:30" },
  3: { start: "11:30", end: "12:30" },
  4: { start: "13:00", end: "14:00" },
  5: { start: "14:00", end: "15:00" },
  6: { start: "15:00", end: "16:00" },
  7: { start: "16:00", end: "16:30" }
};

const getCurrentLectureNo = () => {
  const now = new Date().toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  });

  for (const [lectureNo, slot] of Object.entries(TIME_SLOTS)) {
    if (now >= slot.start && now < slot.end) {
      return Number(lectureNo);
    }
  }
  return null;
};

export const getCurrentLectureForTeacher = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // 1️⃣ Determine current day
    const today = new Date().toLocaleString("en-US", {
      weekday: "long",
      timeZone: "Asia/Kolkata"
    });

    // 2️⃣ Determine lecture number
    const lectureNo = getCurrentLectureNo();

    // No lecture currently
    if (!lectureNo) {
      return res.json({
        success: true,
        data: null
      });
    }

    // 3️⃣ Fetch current lecture from timetable
    const result = await pool.query(
      `
      SELECT
        t.lecture_type,
        t.subject_id,
        s.subject_name,
        t.class_id,
        c.year,
        c.branch,
        t.batch_id
      FROM timetable t
      JOIN subjects s ON s.subject_id = t.subject_id
      JOIN classes c ON c.class_id = t.class_id
      WHERE t.teacher_id = $1
        AND t.day_of_week = $2
        AND t.lecture_no = $3
      LIMIT 1
      `,
      [teacherId, today, lectureNo]
    );

    // Teacher is free in this slot
    if (!result.rowCount) {
      return res.json({
        success: true,
        data: null
      });
    }

    const row = result.rows[0];

    // 4️⃣ Return minimal, UI-friendly payload
    res.json({
      success: true,
      data: {
        lecture_type: row.lecture_type,   // LECTURE / PRACTICAL
        subject_id: row.subject_id,
        class_id: row.class_id,
        batch_id: row.batch_id || null    // ✅ batch OPTIONAL
      }
    });

  } catch (error) {
    console.error("Current lecture fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};


export const getTeacherLectureTypeSubjects = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { lecture_type } = req.query;

    const result = await pool.query(
      `
      SELECT DISTINCT
        s.subject_id,
        s.subject_name
      FROM timetable t
      JOIN subjects s ON s.subject_id = t.subject_id
      WHERE t.teacher_id = $1
        AND ($2::text IS NULL OR t.lecture_type = $2)
      ORDER BY s.subject_name
      `,
      [teacherId, lecture_type || null]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

export const getTeacherClassesForSubjectType = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { subject_id, lecture_type } = req.query;

    if (!subject_id || !lecture_type) {
      return res.status(400).json({ success: false });
    }

    const result = await pool.query(
      `
      SELECT DISTINCT
        c.class_id,
        c.year,
        c.branch
      FROM timetable t
      JOIN classes c ON c.class_id = t.class_id
      WHERE t.teacher_id = $1
        AND t.subject_id = $2
        AND t.lecture_type = $3
      ORDER BY c.year, c.branch
      `,
      [teacherId, subject_id, lecture_type]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};
export const getTeacherBatchesForSubjectClass = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { subject_id, class_id } = req.query;

    if (!subject_id || !class_id) {
      return res.json({
        success: true,
        data: []
      });
    }

    const result = await pool.query(
      `
      SELECT DISTINCT
        b.batch_id,
        b.batch_name
      FROM timetable t
      JOIN batches b ON b.batch_id = t.batch_id
      WHERE t.teacher_id = $1
        AND t.subject_id = $2
        AND t.class_id = $3
      ORDER BY b.batch_name
      `,
      [teacherId, subject_id, class_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};


export const getAttendanceSummary = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const {
      subject_id,
      lecture_type,
      class_id,
      batch_id
    } = req.query;

    if (!subject_id || !lecture_type || !class_id) {
      return res.status(400).json({
        success: false,
        message: "Missing required filters"
      });
    }

    /* ---------------------------------------------------
       1️⃣ Get timetable IDs (VERY selective query)
    --------------------------------------------------- */
    const timetableRes = await pool.query(
      `
      SELECT timetable_id
      FROM timetable
      WHERE teacher_id = $1
        AND subject_id = $2
        AND lecture_type = $3
        AND class_id = $4
        AND ($5::int IS NULL OR batch_id = $5)
      `,
      [teacherId, subject_id, lecture_type, class_id, batch_id || null]
    );

    if (!timetableRes.rowCount) {
      return res.json({ success: true, data: [] });
    }

    const timetableIds = timetableRes.rows.map(r => r.timetable_id);

    /* ---------------------------------------------------
       2️⃣ Aggregate attendance ONCE (critical optimization)
    --------------------------------------------------- */
    const attendanceAggRes = await pool.query(
      `
      SELECT
        student_rollno,
        COUNT(*) AS total_lectures,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present_count
      FROM attendance
      WHERE timetable_id = ANY($1::int[])
      GROUP BY student_rollno
      `,
      [timetableIds]
    );

    const attendanceMap = {};
    attendanceAggRes.rows.forEach(r => {
      attendanceMap[r.student_rollno] = {
        total_lectures: Number(r.total_lectures),
        present_count: Number(r.present_count)
      };
    });

    /* ---------------------------------------------------
       3️⃣ Fetch students (batch-aware)
    --------------------------------------------------- */
    const studentsRes = await pool.query(
      `
      SELECT
        s.student_rollno,
        s.name
      FROM students s
      WHERE s.class_id = $1
        AND (
          $2::int IS NULL
          OR EXISTS (
            SELECT 1
            FROM student_batches sb
            WHERE sb.student_rollno = s.student_rollno
              AND sb.batch_id = $2
          )
        )
      ORDER BY s.student_rollno
      `,
      [class_id, batch_id || null]
    );

    /* ---------------------------------------------------
       4️⃣ Merge result (JS is cheap, DB is expensive)
    --------------------------------------------------- */
    const data = studentsRes.rows.map(s => {
      const att = attendanceMap[s.student_rollno] || {
        total_lectures: 0,
        present_count: 0
      };

      const percentage =
        att.total_lectures === 0
          ? 0
          : ((att.present_count / att.total_lectures) * 100).toFixed(2);

      return {
        student_rollno: s.student_rollno,
        name: s.name,
        total_lectures: att.total_lectures,
        present_count: att.present_count,
        attendance_percentage: percentage
      };
    });

    return res.json({
      success: true,
      data
    });

  } catch (err) {
    console.error("Attendance summary error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};



export const getAttendanceCalendar = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const {
      student_rollno,
      subject_id,
      lecture_type,
      class_id,
      batch_id,
      month
    } = req.query;

    if (
      !student_rollno ||
      !subject_id ||
      !lecture_type ||
      !class_id ||
      !month
    ) {
      return res.status(400).json({ success: false });
    }

    const timetableRes = await pool.query(
      `
      SELECT timetable_id
      FROM timetable
      WHERE teacher_id = $1
        AND subject_id = $2
        AND lecture_type = $3
        AND class_id = $4
        AND (
          $5::int IS NULL
          OR batch_id = $5
        )
      `,
      [teacherId, subject_id, lecture_type, class_id, batch_id || null]
    );

    if (!timetableRes.rowCount) {
      return res.json({ success: true, data: [] });
    }

    const timetableIds = timetableRes.rows.map(r => r.timetable_id);

    const result = await pool.query(
      `
      SELECT
        attendance_date,
        status
      FROM attendance
      WHERE student_rollno = $1
        AND timetable_id = ANY($2::int[])
        AND DATE_TRUNC('month', attendance_date)
            = DATE_TRUNC('month', $3::date)
      ORDER BY attendance_date
      `,
      [student_rollno, timetableIds, `${month}-01`]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error("Attendance calendar error:", err);
    res.status(500).json({ success: false });
  }
};


