import pool from "../config/database.js";

/* =====================================================
   🔹 LAZY MONTH CLOSE (SAFE VERSION)
===================================================== */

const closePreviousMonthIfNeeded = async (studentId, academicYear) => {
  const now = new Date();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = prevMonthDate.getMonth() + 1;

  // 1️⃣ Check if month already stored
  const exists = await pool.query(
    `SELECT 1
     FROM monthly_attendance_summary
     WHERE student_rollno = $1
       AND academic_year = $2
       AND month = $3`,
    [studentId, academicYear, prevMonth]
  );

  if (exists.rowCount > 0) return;

  // 2️⃣ Insert only if attendance exists
  await pool.query(
    `
    WITH subject_data AS (
      SELECT
        t.subject_id,
        ROUND(
          (
            SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::numeric
            / NULLIF(COUNT(*), 0)
          ) * 100
        ) AS subject_percentage
      FROM attendance a
      JOIN timetable t
        ON t.timetable_id = a.timetable_id
      WHERE a.student_rollno = $1
        AND a.submitted = true
        AND t.lecture_type = 'LECTURE'
        AND t.academic_year = $2
        AND EXTRACT(MONTH FROM a.attendance_date) = $3
      GROUP BY t.subject_id
    )

    INSERT INTO monthly_attendance_summary
    (student_rollno, academic_year, month, monthly_percentage)

    SELECT
      $1,
      $2,
      $3,
      ROUND(AVG(subject_percentage))
    FROM subject_data
    HAVING COUNT(*) > 0

    ON CONFLICT (student_rollno, academic_year, month)
    DO NOTHING
    `,
    [studentId, academicYear, prevMonth]
  );
};



/* =====================================================
   🔹 SUBJECT-WISE ATTENDANCE (CTE)
===================================================== */

export const getSubjectWiseAttendance = async (req, res) => {
  const studentId = req.user.id;
  const { academic_year } = req.query;

  try {
    const result = await pool.query(
      `
      WITH subject_data AS (
        SELECT
          t.subject_id,
          sub.subject_name,
          COUNT(*) AS total_lectures,
          SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_lectures
        FROM attendance a
        JOIN timetable t
          ON t.timetable_id = a.timetable_id
        JOIN subjects sub
          ON sub.subject_id = t.subject_id
        WHERE a.student_rollno = $1
          AND a.submitted = true
          AND t.lecture_type = 'LECTURE'
          AND t.academic_year = $2
        GROUP BY t.subject_id, sub.subject_name
      )

      SELECT
        subject_name,
        total_lectures,
        present_lectures,
        ROUND(
          (present_lectures::numeric / NULLIF(total_lectures, 0)) * 100
        ) AS attendance_percentage
      FROM subject_data
      ORDER BY subject_name ASC
      `,
      [studentId, academic_year]
    );

    res.json({ success: true, data: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch subject-wise attendance"
    });
  }
};



/* =====================================================
   🔹 MONTHLY ATTENDANCE (Stored + Current)
===================================================== */

export const getMonthlyAttendance = async (req, res) => {
  const studentId = req.user.id;
  const { academic_year } = req.query;

  try {
    await closePreviousMonthIfNeeded(studentId, academic_year);

    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    // 1️⃣ Fetch stored months
    const storedMonthsResult = await pool.query(
      `
      SELECT month, monthly_percentage
      FROM monthly_attendance_summary
      WHERE student_rollno = $1
        AND academic_year = $2
      ORDER BY month
      `,
      [studentId, academic_year]
    );

    const monthlyData = [];

    // 2️⃣ For each stored month, calculate lecture count
    for (const row of storedMonthsResult.rows) {

      const lectureResult = await pool.query(
        `
        SELECT
          COUNT(*) AS total_lectures,
          SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_lectures
        FROM attendance a
        JOIN timetable t
          ON t.timetable_id = a.timetable_id
        WHERE a.student_rollno = $1
          AND a.submitted = true
          AND t.lecture_type = 'LECTURE'
          AND t.academic_year = $2
          AND EXTRACT(MONTH FROM a.attendance_date) = $3
        `,
        [studentId, academic_year, row.month]
      );

      const lectureData = lectureResult.rows[0];

      monthlyData.push({
        month: row.month,
        monthly_percentage: row.monthly_percentage,
        total_lectures: parseInt(lectureData.total_lectures) || 0,
        present_lectures: parseInt(lectureData.present_lectures) || 0
      });
    }

    // 3️⃣ Add current month if not stored
    const alreadyStored = monthlyData.some(
      (m) => m.month === currentMonth
    );

    if (!alreadyStored) {
      const currentMonthResult = await pool.query(
        `
        WITH subject_data AS (
          SELECT
            t.subject_id,
            COUNT(*) AS total_lectures,
            SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_lectures,
            ROUND(
              (
                SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::numeric
                / NULLIF(COUNT(*), 0)
              ) * 100
            ) AS subject_percentage
          FROM attendance a
          JOIN timetable t
            ON t.timetable_id = a.timetable_id
          WHERE a.student_rollno = $1
            AND a.submitted = true
            AND t.lecture_type = 'LECTURE'
            AND t.academic_year = $2
            AND EXTRACT(MONTH FROM a.attendance_date) = $3
          GROUP BY t.subject_id
        )
        SELECT
          SUM(total_lectures) AS total_lectures,
          SUM(present_lectures) AS present_lectures,
          ROUND(AVG(subject_percentage)) AS monthly_percentage
        FROM subject_data
        `,
        [studentId, academic_year, currentMonth]
      );

      const currentData = currentMonthResult.rows[0];

      if (currentData?.monthly_percentage !== null) {
        monthlyData.push({
          month: currentMonth,
          monthly_percentage: currentData.monthly_percentage,
          total_lectures: parseInt(currentData.total_lectures) || 0,
          present_lectures: parseInt(currentData.present_lectures) || 0
        });
      }
    }

    monthlyData.sort((a, b) => a.month - b.month);

    res.json({
      success: true,
      data: monthlyData
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch monthly attendance"
    });
  }
};




/* =====================================================
   🔹 OVERALL ATTENDANCE (CTE)
===================================================== */

export const getOverallAttendance = async (req, res) => {
  const studentId = req.user.id;
  const { academic_year } = req.query;

  try {
    await closePreviousMonthIfNeeded(studentId, academic_year);

    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    const result = await pool.query(
      `
      WITH current_month_subjects AS (
        SELECT
          t.subject_id,
          ROUND(
            (
              SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::numeric
              / NULLIF(COUNT(*), 0)
            ) * 100,
            2
          ) AS subject_percentage
        FROM attendance a
        JOIN timetable t
          ON t.timetable_id = a.timetable_id
        WHERE a.student_rollno = $1
          AND a.submitted = true
          AND t.lecture_type = 'LECTURE'
          AND t.academic_year = $2
          AND EXTRACT(MONTH FROM a.attendance_date) = $3
        GROUP BY t.subject_id
      ),

      current_month AS (
        SELECT
          ROUND(AVG(subject_percentage)) AS monthly_percentage
        FROM current_month_subjects
      ),

      all_months AS (
        SELECT monthly_percentage
        FROM monthly_attendance_summary
        WHERE student_rollno = $1
          AND academic_year = $2

        UNION ALL

        SELECT monthly_percentage
        FROM current_month
      )

      SELECT
        ROUND(AVG(monthly_percentage)) AS overall_percentage
      FROM all_months
      `,
      [studentId, academic_year, currentMonth]
    );

    res.json({ success: true, data: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch overall attendance"
    });
  }
};
