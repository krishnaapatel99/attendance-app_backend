import pool from "../config/database.js"; 

//Get overall attendance percentage 

export const getOverallAttendance = async (req, res) => {
  const studentId = req.user.id;

  try {
    const result = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_classes,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END)::int AS total_present,
        ROUND(
          (SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END)::numeric
          / NULLIF(COUNT(*), 0)) * 100,
          2
        ) AS attendance_percentage
      FROM attendance
      WHERE student_rollno = $1
        AND submitted = true
      `,
      [studentId]
    );

    res.json({
      success: true,
      data: result.rows[0] ?? {
        total_classes: 0,
        total_present: 0,
        attendance_percentage: 0
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

                             

        
            //Get monthly attendance percentage 
export const getMonthlyAttendance = async (req, res) => {
  const studentId = req.user.id;

  try {
    const result = await pool.query(
      `
      SELECT
        TO_CHAR(attendance_date, 'YYYY-MM') AS month,
        COUNT(*)::int AS total_classes,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END)::int AS present_classes,
        ROUND(
          (SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END)::numeric
          / NULLIF(COUNT(*), 0)) * 100,
          2
        ) AS attendance_percentage
      FROM attendance
      WHERE student_rollno = $1
        AND submitted = true
      GROUP BY month
      ORDER BY month
      `,
      [studentId]
    );

    res.json({ success: true, data: result.rows });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

                                     
                                //Get subject-wise attendance percentage 
                                
export const getSubjectWiseAttendance = async (req, res) => {
  const studentId = req.user.id;

  try {
    const result = await pool.query(
      `
      SELECT
        sub.subject_name,
        COUNT(*)::int AS total_classes,
        SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::int AS present_classes,
        ROUND(
          (SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::numeric
          / NULLIF(COUNT(*), 0)) * 100,
          2
        ) AS attendance_percentage
      FROM attendance a
      JOIN timetable t ON t.timetable_id = a.timetable_id
      JOIN subjects sub ON sub.subject_id = t.subject_id
      WHERE a.student_rollno = $1
        AND a.submitted = true
      GROUP BY sub.subject_name
      ORDER BY sub.subject_name
      `,
      [studentId]
    );

    res.json({ success: true, data: result.rows });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

                                                    
                                                    //Get monthly subject-wise attendance percentage 
                                                    
// export const getMonthlySubjectWiseAttendance = async (req, res) => {
//   const studentId = req.user.id;

//   try {
//     const result = await pool.query(
//       `
//       SELECT
//         sub.subject_name,
//         TO_CHAR(a.attendance_date, 'YYYY-MM') AS month,
//         COUNT(*)::int AS total_classes,
//         SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::int AS present_classes,
//         ROUND(
//           (SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::numeric
//           / NULLIF(COUNT(*), 0)) * 100,
//           2
//         ) AS attendance_percentage
//       FROM attendance a
//       JOIN timetable t ON t.timetable_id = a.timetable_id
//       JOIN subjects sub ON sub.subject_id = t.subject_id
//       WHERE a.student_rollno = $1
//         AND a.submitted = true
//       GROUP BY sub.subject_name, month
//       ORDER BY month, sub.subject_name
//       `,
//       [studentId]
//     );

//     res.json({ success: true, data: result.rows });

//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };
