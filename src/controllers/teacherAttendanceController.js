import pool from "../config/database.js";

//Show data and rows of students 

export const getTeacherDashboard = async (req, res) => { 
    try { const teacherId = req.user.id; // Authenticated teacher ID
        // 1. Teacher basic info 
        const teacherResult = await pool.query( "SELECT teacher_id, name, email FROM teachers WHERE teacher_id = $1",
             [teacherId] );

             if (teacherResult.rows.length === 0) 
                { return res.status(404).json({
                     success: false,
                      message: "Teacher not found" });
                     }
            const teacher = teacherResult.rows[0];
             // 2. Subjects taught by teacher
              const subjectsResult = await pool.query( "SELECT subject_id, subject_name FROM subjects WHERE teacher_id = $1",
                 [teacherId] );

            // 3. Today's schedule 
            const today = new Date().toLocaleString("en-US", { weekday: "long", timeZone: "Asia/Kolkata" }); 
            const todayScheduleResult = await pool.query( `SELECT t.timetable_id, t.class_name, t.lecture_no, 
                s.subject_name 
                FROM timetable t 
                JOIN subjects s ON t.subject_id = s.subject_id 
                WHERE t.teacher_id = $1 AND t.day_of_week = $2 
                ORDER BY t.lecture_no`, 
                [teacherId, today] );

            // 4. Unique students count
             const studentCountResult = await pool.query( `SELECT COUNT(DISTINCT st.student_rollno) AS total_students
       FROM students st
       JOIN attendance a ON st.student_rollno = a.student_rollno
       JOIN timetable t ON a.timetable_id = t.timetable_id
       WHERE t.teacher_id = $1`,
              [teacherId] );

              // Final response
               res.json({ success: true,
                          data: { teacher: 
                            { id: teacher.teacher_id, 
                                name: teacher.name,
                                 email: teacher.email, 
                                 assignedSubjects: subjectsResult.rows }, 
                                 todaySchedule: todayScheduleResult.rows,
                                  totalStudents: studentCountResult.rows[0].total_students } });

            } catch (error)
             { console.error("Error fetching teacher dashboard:", error);
                 res.status(500).json({ success: false,
                     message: "Internal server error",
                      error: error.message }); 
                    }
                 };

// Get students list for attendance marking with current timetable context
export const getStudentsForAttendance = async (req, res) => {
  try {
    const { class_name = 'SE', div = 'A' } = req.query;
    const teacherId = req.user.id;
    
    // Get students
    let query = "SELECT student_rollno, name, class, div, email FROM students";
    let params = [];
    
    if (class_name && div) {
      query += " WHERE class = $1 AND div = $2";
      params = [class_name, div];
    } else if (class_name) {
      query += " WHERE class = $1";
      params = [class_name];
    }
    
    query += " ORDER BY name";
    
    const studentsResult = await pool.query(query, params);
    
    // Get today's schedule for this teacher
    const today = new Date().toLocaleString("en-US", { weekday: "long", timeZone: "Asia/Kolkata" });
    console.log('Fetching schedule for teacher:', teacherId, 'today:', today, 'class:', class_name);
    
    const scheduleResult = await pool.query(
      `SELECT 
        t.timetable_id,
        t.lecture_no,
        s.subject_name,
        s.subject_id
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.subject_id
      WHERE t.teacher_id = $1 AND t.day_of_week = $2 AND t.class_name = $3
      ORDER BY t.lecture_no`,
      [teacherId, today, class_name]
    );
    
    console.log('Schedule found:', scheduleResult.rows);
    
    res.json({
      success: true,
      data: {
        students: studentsResult.rows,
        todaySchedule: scheduleResult.rows,
        currentDay: today
      }
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get attendance data for a specific date and class
export const getAttendanceData = async (req, res) => {
  try {
    const { attendance_date, class_name, div, subject_id, timetable_id } = req.query;
    const teacher_id = req.user.id;
    
    const result = await pool.query(
      `SELECT 
        s.student_rollno,
        s.name,
        s.class,
        s.div,
        a.status,
        a.submitted,
        a.attendance_id
      FROM students s
      LEFT JOIN attendance a ON s.student_rollno = a.student_rollno 
        AND a.attendance_date = $1 
        AND a.subject_id = $2 
        AND a.timetable_id = $3
      WHERE s.class = $4 AND s.div = $5
      ORDER BY s.name`,
      [attendance_date, subject_id, timetable_id, class_name, div]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

                 // Mark attendance for a student 
                 

// Mark or update attendance (before submission)
export const markAttendance = async (req, res) => {
  const { student_rollno, subject_id, timetable_id, status, attendance_date } = req.body;
  const teacher_id = req.user.id;

  console.log('Received attendance data:', {
    student_rollno,
    subject_id,
    timetable_id,
    status,
    attendance_date,
    teacher_id
  });

  try {
    // Check if already marked
    const existing = await pool.query(
      `SELECT * FROM attendance 
       WHERE student_rollno = $1 AND subject_id = $2 AND attendance_date = $3 AND timetable_id = $4`,
      [student_rollno, subject_id, attendance_date, timetable_id]
    );

    if (existing.rows.length > 0) {
      const record = existing.rows[0];

      if (record.submitted) {
        return res.status(400).json({
          success: false,
          message: "Attendance already submitted. Cannot update."
        });
      }

      // Update if not submitted yet
      await pool.query(
        `UPDATE attendance
         SET status = $1, teacher_id = $2
         WHERE attendance_id = $3`,
        [status, teacher_id, record.attendance_id]
      );
    } else {
      // Insert new attendance record
      await pool.query(
        `INSERT INTO attendance (student_rollno, subject_id, teacher_id, timetable_id, status, attendance_date, submitted)
         VALUES ($1, $2, $3, $4, $5, $6, false)`,
        [student_rollno, subject_id, teacher_id, timetable_id, status, attendance_date]
      );
    }

    res.json({ success: true, message: "Attendance saved (not locked yet)" });
  } catch (err) {
    console.error("Error marking attendance:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Submit (lock) attendance for a subject and timetable slot
export const submitAttendance = async (req, res) => {
  const { subject_id, timetable_id, attendance_date } = req.body;
  const teacher_id = req.user.id;

  try {
    await pool.query(
      `UPDATE attendance
       SET submitted = true
       WHERE subject_id = $1 AND timetable_id = $2 AND attendance_date = $3 AND teacher_id = $4`,
      [subject_id, timetable_id, attendance_date, teacher_id]
    );

    res.json({ success: true, message: "Attendance submitted and locked." });
  } catch (err) {
    console.error("Error submitting attendance:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
