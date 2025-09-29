import pool from "../config/database.js";

// Get complete timetable
export const getTimetable = async (req, res) => {
  try {
    const { class_name = 'SE' } = req.query;
    
    const result = await pool.query(
      `SELECT 
        t.timetable_id,
        t.class_name,
        t.day_of_week,
        t.lecture_no,
        s.subject_name,
        s.subject_id,
        tc.name as teacher_name,
        tc.teacher_id
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.subject_id
      JOIN teachers tc ON t.teacher_id = tc.teacher_id
      WHERE t.class_name = $1
      ORDER BY 
        CASE 
          WHEN t.day_of_week = 'Monday' THEN 1
          WHEN t.day_of_week = 'Tuesday' THEN 2
          WHEN t.day_of_week = 'Wednesday' THEN 3
          WHEN t.day_of_week = 'Thursday' THEN 4
          WHEN t.day_of_week = 'Friday' THEN 5
          WHEN t.day_of_week = 'Saturday' THEN 6
          ELSE 7
        END,
        t.lecture_no`,
      [class_name]
    );

    // Organize data by day and lecture
    const timetableByDay = {};
    const timeSlots = [
      { lecture: 1, time: '9:30-10:30' },
      { lecture: 2, time: '10:30-11:30' },
      { lecture: 3, time: '11:30-12:30' },
      { lecture: 4, time: '1:00-2:00' },
      { lecture: 5, time: '2:00-3:00' },
      { lecture: 6, time: '3:00-4:00' },
      { lecture: 7, time: '4:00-4:30' }
    ];

    result.rows.forEach(row => {
      if (!timetableByDay[row.day_of_week]) {
        timetableByDay[row.day_of_week] = {};
      }
      timetableByDay[row.day_of_week][row.lecture_no] = {
        timetable_id: row.timetable_id,
        subject_name: row.subject_name,
        subject_id: row.subject_id,
        teacher_name: row.teacher_name,
        teacher_id: row.teacher_id
      };
    });

    res.json({
      success: true,
      data: {
        timetable: timetableByDay,
        timeSlots: timeSlots,
        class_name: class_name
      }
    });
  } catch (error) {
    console.error('Error fetching timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get today's schedule for a specific user
export const getTodaySchedule = async (req, res) => {
  try {
    const today = new Date().toLocaleString("en-US", { weekday: "long", timeZone: "Asia/Kolkata" });
    const userRole = req.user.role;
    const userId = req.user.id;
    
    let query;
    let params;
    
    if (userRole === 'teacher') {
      query = `
        SELECT 
          t.timetable_id,
          t.class_name,
          t.day_of_week,
          t.lecture_no,
          s.subject_name,
          s.subject_id,
          tc.name as teacher_name
        FROM timetable t
        JOIN subjects s ON t.subject_id = s.subject_id
        JOIN teachers tc ON t.teacher_id = tc.teacher_id
        WHERE t.teacher_id = $1 AND t.day_of_week = $2
        ORDER BY t.lecture_no
      `;
      params = [userId, today];
    } else {
      // For students, show all classes for their class
      query = `
        SELECT 
          t.timetable_id,
          t.class_name,
          t.day_of_week,
          t.lecture_no,
          s.subject_name,
          s.subject_id,
          tc.name as teacher_name
        FROM timetable t
        JOIN subjects s ON t.subject_id = s.subject_id
        JOIN teachers tc ON t.teacher_id = tc.teacher_id
        WHERE t.class_name = 'SE' AND t.day_of_week = $1
        ORDER BY t.lecture_no
      `;
      params = [today];
    }
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      today: today
    });
  } catch (error) {
    console.error('Error fetching today schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get subjects for a teacher
export const getTeacherSubjects = async (req, res) => {
  try {
    const teacherId = req.user.id;
    
    const result = await pool.query(
      `SELECT DISTINCT s.subject_id, s.subject_name
       FROM subjects s
       WHERE s.teacher_id = $1
       ORDER BY s.subject_name`,
      [teacherId]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching teacher subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get timetable entries for a specific subject and teacher
export const getSubjectTimetable = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { subject_id } = req.query;
    
    const result = await pool.query(
      `SELECT 
        t.timetable_id,
        t.class_name,
        t.day_of_week,
        t.lecture_no,
        s.subject_name
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.subject_id
      WHERE t.teacher_id = $1 AND t.subject_id = $2
      ORDER BY 
        CASE 
          WHEN t.day_of_week = 'Monday' THEN 1
          WHEN t.day_of_week = 'Tuesday' THEN 2
          WHEN t.day_of_week = 'Wednesday' THEN 3
          WHEN t.day_of_week = 'Thursday' THEN 4
          WHEN t.day_of_week = 'Friday' THEN 5
          WHEN t.day_of_week = 'Saturday' THEN 6
          ELSE 7
        END,
        t.lecture_no`,
      [teacherId, subject_id]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching subject timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};