import pool from "../config/database.js";



export const getAdvisorClassAttendance = async (req, res) => {
  try {
    const teacherId = req.user.id;

    /* ---------------------------------------------------
       1️⃣ Verify advisor
    --------------------------------------------------- */
    const advisorRes = await pool.query(
      `SELECT class_id FROM advisors WHERE teacher_id = $1`,
      [teacherId]
    );

    if (!advisorRes.rowCount) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned as an advisor",
      });
    }

    const classId = advisorRes.rows[0].class_id;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    /* ---------------------------------------------------
       2️⃣ Fetch all students of advisor class
    --------------------------------------------------- */
    const studentsRes = await pool.query(
      `
      SELECT student_rollno, name
      FROM students
      WHERE class_id = $1
      ORDER BY student_rollno
      `,
      [classId]
    );

    if (!studentsRes.rowCount) {
      return res.json({
        success: true,
        students: [],
      });
    }

    const students = studentsRes.rows;

    /* ---------------------------------------------------
       3️⃣ Current month subject-wise (LECTURE only)
    --------------------------------------------------- */
    const subjectRes = await pool.query(
      `
      SELECT
        a.student_rollno,
        t.subject_id,
        sub.subject_name,
        COUNT(*)::int AS total_lectures,
        SUM(
          CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END
        )::int AS present_count
      FROM attendance a
      JOIN timetable t
        ON t.timetable_id = a.timetable_id
        AND t.class_id = $1
        AND t.lecture_type = 'LECTURE'
      JOIN subjects sub
        ON sub.subject_id = t.subject_id
      WHERE a.submitted = true
        AND EXTRACT(MONTH FROM a.attendance_date) = $2
        AND EXTRACT(YEAR FROM a.attendance_date) = $3
      GROUP BY a.student_rollno, t.subject_id, sub.subject_name
      `,
      [classId, currentMonth, currentYear]
    );

    /* ---------------------------------------------------
       4️⃣ Stored monthly data
    --------------------------------------------------- */
    const monthlyStoredRes = await pool.query(
      `
      SELECT student_rollno, monthly_percentage
      FROM monthly_attendance_summary
      WHERE student_rollno = ANY($1::text[])
      `,
      [students.map(s => s.student_rollno)]
    );

    /* ---------------------------------------------------
       5️⃣ Organize subject data
    --------------------------------------------------- */
    const subjectMap = {};

    subjectRes.rows.forEach(row => {
      const subjectPercentage =
        row.total_lectures > 0
          ? Math.round((row.present_count / row.total_lectures) * 100)
          : 0;

      if (!subjectMap[row.student_rollno]) {
        subjectMap[row.student_rollno] = [];
      }

      subjectMap[row.student_rollno].push({
        subject_id: row.subject_id,
        subject_name: row.subject_name,
        total_lectures: row.total_lectures,
        present: row.present_count,
        percentage: subjectPercentage
      });
    });

    /* ---------------------------------------------------
       6️⃣ Organize stored months
    --------------------------------------------------- */
    const monthlyMap = {};

    monthlyStoredRes.rows.forEach(row => {
      if (!monthlyMap[row.student_rollno]) {
        monthlyMap[row.student_rollno] = [];
      }
      monthlyMap[row.student_rollno].push(
        Number(row.monthly_percentage)
      );
    });

    /* ---------------------------------------------------
       7️⃣ Build final result per student
    --------------------------------------------------- */
    const finalStudents = students.map(student => {
      const subjects = subjectMap[student.student_rollno] || [];

      // Current month %
      const currentMonthPercentage =
        subjects.length > 0
          ? Math.round(
              subjects.reduce((sum, s) => sum + s.percentage, 0) /
                subjects.length
            )
          : 0;

      // Stored months
      const storedMonths = monthlyMap[student.student_rollno] || [];

      // Overall calculation
      const allMonths =
        currentMonthPercentage > 0
          ? [...storedMonths, currentMonthPercentage]
          : storedMonths;

      const overallPercentage =
        allMonths.length > 0
          ? Math.round(
              allMonths.reduce((sum, m) => sum + m, 0) /
                allMonths.length
            )
          : 0;

      // Total lectures current month
      const totalLecturesCurrentMonth = subjects.reduce(
        (sum, s) => sum + s.total_lectures,
        0
      );

      return {
        rollNo: student.student_rollno,
        name: student.name,
        totalLecturesCurrentMonth,
        currentMonthPercentage,
        overallPercentage,
        subjects
      };
    });

    /* --------------------------------------------------- */
    res.json({
      success: true,
      month: `${currentYear}-${String(currentMonth).padStart(2, "0")}`,
      students: finalStudents
    });

  } catch (error) {
    console.error("Advisor attendance error:", error);
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

