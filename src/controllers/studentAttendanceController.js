import pool from "../config/database.js"; 

//Get overall attendance percentage 

export const getOverallAttendance = async (req, res) => { 
    const studentId = req.user.id; 
    try {
         const result = await pool.query( `SELECT 
            SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END)::int AS 
            total_present,
             COUNT(*)::int AS total_classes,
              ROUND( (SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) 
              AS attendance_percentage FROM attendance WHERE student_rollno = $1`,
               [studentId] ); 
               
               res.json({ success: true,
                 data: result.rows[0] ?? { total_present: 0, total_classes: 0, attendance_percentage: 0 }
                 }); 
                    } catch (err)
                     {
                         res.status(500).json({ success: false,
                             error: err.message }); } }; 
                             
            //Get monthly attendance percentage 
            export const getMonthlyAttendance = async (req, res) =>
                 { 
                    const studentId = req.user.id;
                     try {
                         const result = await pool.query( `SELECT TO_CHAR(attendance_date, 'YYYY-MM')
                          AS month, 
                          SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END)::int AS present_classes,
                           COUNT(*)::int AS total_classes,
                            ROUND( (SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) 
                            AS attendance_percentage FROM attendance WHERE student_rollno = $1 GROUP BY 1 ORDER BY 1`,
                             [studentId] ); 
                             
                             res.json({ success: true, data: result.rows }); 
                            }
                             catch (err)
                              { 
                                res.status(500).json({ success: false,
                                     error: err.message }); } }; 
                                     
                                //Get subject-wise attendance percentage 
                                
                            export const getSubjectWiseAttendance = async (req, res) => { 
                                const studentId = req.user.id; 
                                try {
                                     const result = await pool.query(` SELECT s.subject_name,
                                         SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::int AS present_classes,
                                          COUNT(*)::int AS total_classes,
                                           ROUND( (SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2)
                                            AS attendance_percentage FROM attendance a 
                                            JOIN subjects s ON a.subject_id = s.subject_id 
                                            WHERE a.student_rollno = $1 
                                            GROUP BY s.subject_name
                                             ORDER BY s.subject_name`, 
                                             [studentId] );
                                             
                                             res.json({ success: true, 
                                                data: result.rows });
                                             } catch (err)
                                              { 
                                                res.status(500).json({ success: false, 
                                                    error: err.message }); } };
                                                    
                                                    //Get monthly subject-wise attendance percentage 
                                                    
                                                    export const getMonthlySubjectWiseAttendance = async (req, res) => { 
                                                        const studentId = req.user.id;
                                                         try {
                                                             const result = await pool.query(` SELECT s.subject_name,
                                                                 TO_CHAR(a.attendance_date, 'YYYY-MM')
                                                                  AS month, SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::int AS present_classes,
                                                                   COUNT(*)::int AS total_classes,
                                                                   ROUND( (SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2)
                                                                    AS attendance_percentage FROM attendance a
                                                                     JOIN subjects s ON a.subject_id = s.subject_id
                                                                      WHERE a.student_rollno = $1 GROUP BY s.subject_name, 2 ORDER BY 2,
                                                                       s.subject_name`,
                                                                        [studentId] );
                                                                        
                                                                        res.json({ success: true,
                                                                             data: result.rows });
                                                                             } catch (err)
                                                                              {
                                                                                 res.status(500).json({ success: false, error: err.message }); } };