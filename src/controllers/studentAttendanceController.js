import pool from "../config/database.js"; 


export const getOverallAttendance = async (req, res) => {
  const studentId = req.user.id;

  try {
    const result = await pool.query(
      `
      SELECT
        COALESCE(SUM(total_classes), 0)::int AS total_classes,
        COALESCE(SUM(present_classes), 0)::int AS total_present,
        ROUND(
          (
            SUM(present_classes)::numeric
            / NULLIF(SUM(total_classes), 0)
          ) * 100,
          2
        ) AS attendance_percentage
      FROM (

        -- 🔹 January Manual Attendance
        SELECT
          total_lectures AS total_classes,
          attended_lectures AS present_classes
        FROM attendance_manual_summary
        WHERE student_rollno = $1

        UNION ALL

        -- 🔹 Real Attendance (Feb → ∞)
        SELECT
          COUNT(*) AS total_classes,
          SUM(
            CASE 
              WHEN a.status = 'Present' THEN 1
              ELSE 0
            END
          ) AS present_classes
        FROM attendance a
        WHERE a.student_rollno = $1
          AND a.submitted = true
          AND EXTRACT(MONTH FROM a.attendance_date) > 1

      ) merged
      `,
      [studentId]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch attendance"
    });
  }
};




//Get overall attendance percentage including januray


// export const getOverallAttendance = async (req, res) => {
//   const studentId = req.user.id;

//   try {
//     const result = await pool.query(
//       `
//       SELECT
//         COUNT(*)::int AS total_classes,
//         SUM(
//           CASE
//             WHEN a.status = 'Present' THEN 1
//             ELSE 0
//           END
//         )::int AS total_present,
//         ROUND(
//           (
//             SUM(
//               CASE
//                 WHEN a.status = 'Present' THEN 1
//                 ELSE 0
//               END
//             )::numeric
//             / NULLIF(COUNT(*), 0)
//           ) * 100,
//           2
//         ) AS attendance_percentage
//       FROM attendance a
//       WHERE a.student_rollno = $1
//         AND a.submitted = true
//       `,
//       [studentId]
//     );

//     res.json({
//       success: true,
//       data: result.rows[0]
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch attendance"
//     });
//   }
// };


                             
export const getMonthlyAttendance = async (req, res) => {
  const studentId = req.user.id;

  try {
    const result = await pool.query(
      `
      SELECT
        month,
        SUM(total_classes)::int AS total_classes,
        SUM(present_classes)::int AS present_classes,
        ROUND(
          (
            SUM(present_classes)::numeric
            / NULLIF(SUM(total_classes), 0)
          ) * 100,
          2
        ) AS attendance_percentage
      FROM (

        -- 🔹 January Manual Data
        SELECT
          TO_CHAR(
            TO_DATE(month::text, 'MM'),
            'YYYY-MM'
          ) AS month,
          total_lectures AS total_classes,
          attended_lectures AS present_classes
        FROM attendance_manual_summary
        WHERE student_rollno = $1

        UNION ALL

        -- 🔹 Real Attendance (Feb → ∞)
        SELECT
          TO_CHAR(a.attendance_date, 'YYYY-MM') AS month,
          COUNT(*) AS total_classes,
          SUM(
            CASE
              WHEN a.status = 'Present' THEN 1
              ELSE 0
            END
          ) AS present_classes
        FROM attendance a
        WHERE a.student_rollno = $1
          AND a.submitted = true
          AND EXTRACT(MONTH FROM a.attendance_date) > 1
        GROUP BY TO_CHAR(a.attendance_date, 'YYYY-MM')

      ) merged
      GROUP BY month
      ORDER BY month
      `,
      [studentId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch monthly attendance"
    });
  }
};

        
            //Get monthly attendance percentage 
// export const getMonthlyAttendance = async (req, res) => {
//   const studentId = req.user.id;

//   try {
//     const result = await pool.query(
//       `
//       SELECT
//         TO_CHAR(a.attendance_date, 'YYYY-MM') AS month,
//         COUNT(*)::int AS total_classes,
//         SUM(
//           CASE
//             WHEN a.status = 'Present' THEN 1
//             ELSE 0
//           END
//         )::int AS present_classes,
//         ROUND(
//           (
//             SUM(
//               CASE
//                 WHEN a.status = 'Present' THEN 1
//                 ELSE 0
//               END
//             )::numeric
//             / NULLIF(COUNT(*), 0)
//           ) * 100,
//           2
//         ) AS attendance_percentage
//       FROM attendance a
//       WHERE a.student_rollno = $1
//         AND a.submitted = true
//       GROUP BY month
//       ORDER BY month
//       `,
//       [studentId]
//     );

//     res.json({
//       success: true,
//       data: result.rows
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch monthly attendance"
//     });
//   }
// };



export const getSubjectWiseAttendance = async (req, res) => {
         const studentId = req.user.id;

  try {
    const result = await pool.query(
      `
      SELECT
        sub.subject_name,
        SUM(total_classes)::int AS total_classes,
        SUM(present_classes)::int AS present_classes,
        ROUND(
          (
            SUM(present_classes)::numeric
            / NULLIF(SUM(total_classes), 0)
          ) * 100,
          2
        ) AS attendance_percentage
      FROM (

        -- 🔹 January Manual Subject-wise
        SELECT
          m.subject_id,
          m.total_lectures AS total_classes,
          m.attended_lectures AS present_classes
        FROM attendance_manual_summary m
        WHERE m.student_rollno = $1

        UNION ALL

        -- 🔹 Real Attendance (Feb → ∞)
        SELECT
          t.subject_id,
          COUNT(*) AS total_classes,
          SUM(
            CASE
              WHEN a.status = 'Present' THEN 1
              ELSE 0
            END
          ) AS present_classes
        FROM attendance a
        JOIN timetable t
          ON t.timetable_id = a.timetable_id
        WHERE a.student_rollno = $1
          AND a.submitted = true
          AND EXTRACT(MONTH FROM a.attendance_date) > 1
        GROUP BY t.subject_id

      ) merged
      JOIN subjects sub
        ON sub.subject_id = merged.subject_id
      GROUP BY sub.subject_name
      ORDER BY sub.subject_name
      `,
      [studentId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch subject-wise attendance"
    });
  }
};
                            
 
// export const getSubjectWiseAttendance = async (req, res) => {
//   const studentId = req.user.id;

//   try {
//     const result = await pool.query(
//       `
//       SELECT
//         sub.subject_name,
//         COUNT(*)::int AS total_classes,
//         SUM(
//           CASE
//             WHEN a.status = 'Present' THEN 1
//             ELSE 0
//           END
//         )::int AS present_classes,
//         ROUND(
//           (
//             SUM(
//               CASE
//                 WHEN a.status = 'Present' THEN 1
//                 ELSE 0
//               END
//             )::numeric
//             / NULLIF(COUNT(*), 0)
//           ) * 100,
//           2
//         ) AS attendance_percentage
//       FROM attendance a
//       JOIN timetable t
//         ON t.timetable_id = a.timetable_id
//       JOIN subjects sub
//         ON sub.subject_id = t.subject_id
//       WHERE a.student_rollno = $1
//         AND a.submitted = true
//       GROUP BY sub.subject_name
//       ORDER BY sub.subject_name
//       `,
//       [studentId]
//     );

//     res.json({
//       success: true,
//       data: result.rows
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch subject-wise attendance"
//     });
//   }
// };



                                                    
//                                                     Get monthly subject-wise attendance percentage 
                                                    
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
