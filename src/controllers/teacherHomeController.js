import pool from "../config/database.js";
import { redisGetSafe, redisSetSafe } from "../utils/redisSafe.js";

export const getTeacherProfile = async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Teachers only",
      });
    }

    const teacherId = req.user.id;
    const redisKey = `teacher:profile:${teacherId}`;

    // 1️⃣ Redis (safe)
    const cached = await redisGetSafe(redisKey);
    if (cached) {
      return res.json({
        success: true,
        name: JSON.parse(cached).name,
        source: "redis",
      });
    }

    // 2️⃣ DB
    const result = await pool.query(
      "SELECT name FROM teachers WHERE teacher_id = $1",
      [teacherId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    const responseData = {
      success: true,
      name: result.rows[0].name,
      source: "database",
    };

    // 3️⃣ Cache (safe – 7 days)
    await redisSetSafe(
      redisKey,
      JSON.stringify(responseData),
      { EX: 60 * 60 * 24 * 7 }
    );

    res.json(responseData);

  } catch (error) {
    console.error("Error fetching teacher profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
