import pool from "../config/database.js";

export const getAdvisorClassAttendance = async (req, res) => {
  try {
    const teacherId = req.user.id;

    /* 1️⃣ Get advisor class */
    const advisorRes = await pool.query(
      `SELECT class_id FROM advisors WHERE teacher_id = $1`,
      [teacherId]
    );

    if (advisorRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned as an advisor",
      });
    }

    const classId = advisorRes.rows[0].class_id;

    /* 2️⃣ Fetch CURRENT MONTH attendance */
    const result = await pool.query(
      `
      SELECT
        s.student_rollno,
        s.name AS student_name,

        COUNT(a.attendance_id)::int AS total_lectures,
        SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::int AS present_count,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'subject_id', sub.subject_id,
              'subject_name', sub.subject_name,
              'total', subj.total,
              'present', subj.present
            )
          ) FILTER (WHERE sub.subject_id IS NOT NULL),
          '[]'
        ) AS subject_wise

      FROM students s

      LEFT JOIN attendance a
        ON a.student_rollno = s.student_rollno
        AND DATE_TRUNC('month', a.attendance_date) = DATE_TRUNC('month', CURRENT_DATE)

      LEFT JOIN timetable t
        ON t.timetable_id = a.timetable_id

      LEFT JOIN subjects sub
        ON sub.subject_id = t.subject_id

      LEFT JOIN (
        SELECT
          s2.student_rollno,
          t2.subject_id,
          COUNT(*) AS total,
          SUM(CASE WHEN a2.status = 'Present' THEN 1 ELSE 0 END) AS present
        FROM attendance a2
        JOIN timetable t2 ON t2.timetable_id = a2.timetable_id
        JOIN students s2 ON s2.student_rollno = a2.student_rollno
        WHERE DATE_TRUNC('month', a2.attendance_date) = DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY s2.student_rollno, t2.subject_id
      ) subj
        ON subj.student_rollno = s.student_rollno
        AND subj.subject_id = sub.subject_id

      WHERE s.class_id = $1
      GROUP BY s.student_rollno, s.name
      ORDER BY s.student_rollno
      `,
      [classId]
    );

    /* 3️⃣ Format response */
    res.json({
      success: true,
      classId,
      month: new Date().toISOString().slice(0, 7), 
      students: result.rows.map((row) => ({
        rollNo: row.student_rollno,
        name: row.student_name,
        totalLectures: row.total_lectures,
        present: row.present_count,
        percentage:
          row.total_lectures > 0
            ? Math.round((row.present_count / row.total_lectures) * 100)
            : 0,
        subjects: row.subject_wise,
      })),
    });
  } catch (error) {
    console.error("Advisor class attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



export const getStudentLecturesForAdvisor = async (req, res) => {
  const teacherId = req.user.id;
  const { student_rollno, date } = req.query;

  if (!student_rollno || !date) {
    return res.status(400).json({
      success: false,
      message: "student_rollno and date are required",
    });
  }

  try {
    /* 1️⃣ Verify advisor + class */
    const advisorRes = await pool.query(
      `SELECT class_id FROM advisors WHERE teacher_id = $1`,
      [teacherId]
    );

    if (advisorRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You are not an advisor",
      });
    }

    const classId = advisorRes.rows[0].class_id;

    /* 2️⃣ Verify student belongs to advisor class */
    const studentRes = await pool.query(
      `
      SELECT student_rollno, name
      FROM students
      WHERE student_rollno = $1
        AND class_id = $2
      `,
      [student_rollno, classId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Student not under your advisory class",
      });
    }

    /* 3️⃣ Fetch lecture-wise attendance for that date */
    const attendanceRes = await pool.query(
      `
      SELECT
        a.attendance_id,
        t.lecture_no,
        t.lecture_type,
        sub.subject_name,
        a.status,
        a.submitted
      FROM attendance a
      JOIN timetable t ON t.timetable_id = a.timetable_id
      JOIN subjects sub ON sub.subject_id = t.subject_id
      WHERE a.student_rollno = $1
        AND a.attendance_date = $2
      ORDER BY t.lecture_no
      `,
      [student_rollno, date]
    );

    res.json({
      success: true,
      student: studentRes.rows[0],
      date,
      lectures: attendanceRes.rows,
    });

  } catch (err) {
    console.error("Advisor lecture fetch error:", err);
    res.status(500).json({ success: false });
  }
};

export const updateLecturesByAdvisor = async (req, res) => {
  const teacherId = req.user.id;
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No updates provided",
    });
  }

  try {
    /* 1️⃣ Verify advisor */
    const advisorRes = await pool.query(
      `SELECT class_id FROM advisors WHERE teacher_id = $1`,
      [teacherId]
    );

    if (advisorRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You are not an advisor",
      });
    }
    const classId = advisorRes.rows[0].class_id;
    const attendanceIds = updates.map(u => u.attendance_id);

    /* 2️⃣ Fetch current state */
    const currentRes = await pool.query(
      `
      SELECT
        a.attendance_id,
        a.status AS old_status,
        a.submitted,
        t.lecture_no,
        sub.subject_name
      FROM attendance a
JOIN timetable t ON t.timetable_id = a.timetable_id
JOIN subjects sub ON sub.subject_id = t.subject_id
JOIN students s ON s.student_rollno = a.student_rollno
WHERE a.attendance_id = ANY($1::int[])
  AND s.class_id = $2
      `,
      [attendanceIds, classId]
    );

    const results = [];
    const idsToUpdate = [];
    const newStatuses = [];

    for (const row of currentRes.rows) {
      const requested = updates.find(
        u => u.attendance_id === row.attendance_id
      );

      if (!requested) continue;

      if (!row.submitted) {
        results.push({
          attendance_id: row.attendance_id,
          lecture_no: row.lecture_no,
          subject: row.subject_name,
          updated: false,
          reason: "Attendance not submitted",
        });
        continue;
      }

      if (!["Present", "Absent"].includes(requested.status)) {
        results.push({
          attendance_id: row.attendance_id,
          lecture_no: row.lecture_no,
          subject: row.subject_name,
          updated: false,
          reason: "Invalid status",
        });
        continue;
      }

      if (row.old_status === requested.status) {
        results.push({
          attendance_id: row.attendance_id,
          lecture_no: row.lecture_no,
          subject: row.subject_name,
          updated: false,
          reason: "No change",
        });
        continue;
      }

      // ✅ Allowed change
      idsToUpdate.push(row.attendance_id);
      newStatuses.push(requested.status);

      results.push({
        attendance_id: row.attendance_id,
        lecture_no: row.lecture_no,
        subject: row.subject_name,
        updated: true,
        old_status: row.old_status,
        new_status: requested.status,
      });
    }

    /* 3️⃣ BULK update valid rows */
    if (idsToUpdate.length > 0) {
      await pool.query(
        `
        UPDATE attendance
        SET status = data.status,
            updated_at = CURRENT_TIMESTAMP
        FROM (
          SELECT
            UNNEST($1::int[])  AS attendance_id,
            UNNEST($2::text[]) AS status
        ) AS data
        WHERE attendance.attendance_id = data.attendance_id
        `,
        [idsToUpdate, newStatuses]
      );
    }

    res.json({
      success: true,
      updatedCount: idsToUpdate.length,
      results,
    });

  } catch (err) {
    console.error("Advisor update error:", err);
    res.status(500).json({ success: false });
  }
};

