import pool from "../config/database.js";
import redisClient from "../config/redis.js";

const TIME_SLOTS = {
  1: "9:30-10:30",
  2: "10:30-11:30",
  3: "11:30-12:30",
  4: "1:00-2:00",
  5: "2:00-3:00",
  6: "3:00-4:00",
  7: "4:00-4:30"
};

/* =====================================================
   STUDENT WEEKLY TIMETABLE (WITH REDIS)
===================================================== */
export const getStudentWeeklyTimetable = async (req, res) => {
  try {
    const studentId = req.user.id;
    const redisKey = `student:timetable:${studentId}`;

    // 1️⃣ CHECK REDIS FIRST
    const cachedData = await redisClient.get(redisKey);
    if (cachedData) {
      console.log("⚡ Student timetable from Redis");
      return res.json({
        ...JSON.parse(cachedData),
        source: "redis"
      });
    }

    // 2️⃣ FETCH STUDENT CLASS
    const studentRes = await pool.query(
      `SELECT class_id FROM students WHERE student_rollno = $1`,
      [studentId]
    );

    if (!studentRes.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    const classId = studentRes.rows[0].class_id;

    // 3️⃣ FETCH STUDENT BATCHES
    const batchRes = await pool.query(
      `SELECT batch_id FROM student_batches WHERE student_rollno = $1`,
      [studentId]
    );
    const batchIds = batchRes.rows.map(b => b.batch_id);

    // 4️⃣ FETCH TIMETABLE FROM DB
    const result = await pool.query(
      `SELECT
        t.day_of_week,
        t.lecture_no,
        t.duration,
        t.lecture_type,
        s.subject_name,
        tc.name AS teacher_name,
        b.batch_name
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.subject_id
      JOIN teachers tc ON t.teacher_id = tc.teacher_id
      LEFT JOIN batches b ON t.batch_id = b.batch_id
      WHERE
        t.class_id = $1
        AND (
          t.lecture_type = 'LECTURE'
          OR (
            t.lecture_type = 'PRACTICAL'
            AND t.batch_id = ANY($2::int[])
          )
        )
      ORDER BY
        CASE
          WHEN t.day_of_week = 'Monday' THEN 1
          WHEN t.day_of_week = 'Tuesday' THEN 2
          WHEN t.day_of_week = 'Wednesday' THEN 3
          WHEN t.day_of_week = 'Thursday' THEN 4
          WHEN t.day_of_week = 'Friday' THEN 5
          WHEN t.day_of_week = 'Saturday' THEN 6
        END,
        t.lecture_no`,
      [classId, batchIds]
    );

    // 5️⃣ BUILD FINAL TIMETABLE
    const timetable = {};

    result.rows.forEach(row => {
      if (!timetable[row.day_of_week]) {
        timetable[row.day_of_week] = {};
      }

      for (let i = 0; i < row.duration; i++) {
        const slotNo = row.lecture_no + i;
        if (!TIME_SLOTS[slotNo]) break;

        timetable[row.day_of_week][slotNo] = {
          subject: row.subject_name,
          type: row.lecture_type,
          teacher: row.teacher_name,
          batch: row.lecture_type === "PRACTICAL" ? row.batch_name : null,
          time: TIME_SLOTS[slotNo],
          isContinuation: i > 0,
          parentLecture: row.lecture_no
        };
      }
    });

    const responseData = {
      success: true,
      role: "student",
      timetable,
      timeSlots: TIME_SLOTS,
      source: "database"
    };

    // 6️⃣ SAVE TO REDIS (90 DAYS)
    await redisClient.set(
      redisKey,
      JSON.stringify(responseData),
      { EX: 60 * 60 * 24 * 120 }
    );

    res.json(responseData);

  } catch (error) {
    console.error("Student timetable error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* =====================================================
   TEACHER WEEKLY TIMETABLE (WITH REDIS)
===================================================== */
export const getTeacherWeeklyTimetable = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const redisKey = `teacher:timetable:${teacherId}`;

    // 1️⃣ CHECK REDIS FIRST
    const cachedData = await redisClient.get(redisKey);
    if (cachedData) {
      console.log("⚡ Teacher timetable from Redis");
      return res.json({
        ...JSON.parse(cachedData),
        source: "redis"
      });
    }

    // 2️⃣ FETCH TIMETABLE FROM DB
    const result = await pool.query(
      `SELECT
        t.day_of_week,
        t.lecture_no,
        t.lecture_type,
        t.duration,
        s.subject_name,
        c.year,
        c.branch,
        b.batch_name
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.subject_id
      JOIN classes c ON t.class_id = c.class_id
      LEFT JOIN batches b ON t.batch_id = b.batch_id
      WHERE t.teacher_id = $1
      ORDER BY
        CASE
          WHEN t.day_of_week = 'Monday' THEN 1
          WHEN t.day_of_week = 'Tuesday' THEN 2
          WHEN t.day_of_week = 'Wednesday' THEN 3
          WHEN t.day_of_week = 'Thursday' THEN 4
          WHEN t.day_of_week = 'Friday' THEN 5
          WHEN t.day_of_week = 'Saturday' THEN 6
        END,
        t.lecture_no`,
      [teacherId]
    );

    const timetable = {};

    result.rows.forEach(row => {
      if (!timetable[row.day_of_week]) {
        timetable[row.day_of_week] = {};
      }

      for (let i = 0; i < row.duration; i++) {
        const slotNo = row.lecture_no + i;
        if (!TIME_SLOTS[slotNo]) break;

        timetable[row.day_of_week][slotNo] = {
          subject: row.subject_name,
          type: row.lecture_type,
          class: `${row.year} ${row.branch}`,
          batch: row.lecture_type === "PRACTICAL" ? row.batch_name : null,
          time: TIME_SLOTS[slotNo],
          isContinuation: i > 0,
          parentLecture: row.lecture_no
        };
      }
    });

    const responseData = {
      success: true,
      role: "teacher",
      timetable,
      timeSlots: TIME_SLOTS,
      source: "database"
    };

    // 3️⃣ SAVE TO REDIS (90 DAYS)
    await redisClient.set(
      redisKey,
      JSON.stringify(responseData),
      { EX: 60 * 60 * 24 * 120 }
    );

    res.json(responseData);

  } catch (error) {
    console.error("Teacher timetable error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
