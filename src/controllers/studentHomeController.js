import pool from "../config/database.js";
import redisClient from "../config/redis.js";

export const getStudentProfile = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Students only"
      });
    }

    const studentId = req.user.id;
    const redisKey = `student:profile:${studentId}`;

    // 1️⃣ Check Redis
    const cached = await redisClient.get(redisKey);
    if (cached) {
      return res.json({
        success: true,
        name: JSON.parse(cached).name,
        source: "redis"
      });
    }

    // 2️⃣ DB query
    const result = await pool.query(
      "SELECT name FROM students WHERE student_rollno = $1",
      [studentId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    const responseData = {
      success: true,
      name: result.rows[0].name,
      source: "database"
    };

    // 3️⃣ Cache for 7 days
    await redisClient.set(
      redisKey,
      JSON.stringify(responseData),
      { EX: 60 * 60 * 24 * 7 }
    );

    res.json(responseData);

  } catch (error) {
    console.error("Error fetching student profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
