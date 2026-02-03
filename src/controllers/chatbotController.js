import pool from "../config/database.js";
import axios from "axios";

// Rate limiting configuration
const RATE_LIMITS = {
  DAILY_LIMIT: 10,           // 10 questions per day per student
  MINUTE_LIMIT: 1,           // 1 question per 2 minutes
  MINUTE_WINDOW: 2 * 60 * 1000, // 2 minutes in milliseconds
};

// RAG Service URL (replace with your actual RAG service endpoint)
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "https://your-rag-service.com/api/chat";
const RAG_API_KEY = process.env.RAG_API_KEY;

/**
 * Check if student has exceeded rate limits
 */
const checkRateLimit = async (client, studentRollno) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const twoMinutesAgo = new Date(now.getTime() - RATE_LIMITS.MINUTE_WINDOW);

  // Check daily limit
  const dailyCount = await client.query(
    `SELECT COUNT(*) as count 
     FROM chatbot_usage 
     WHERE student_rollno = $1 
     AND DATE(created_at) = $2`,
    [studentRollno, today]
  );

  if (parseInt(dailyCount.rows[0].count) >= RATE_LIMITS.DAILY_LIMIT) {
    return {
      allowed: false,
      reason: 'daily_limit',
      message: `Daily limit of ${RATE_LIMITS.DAILY_LIMIT} questions reached. Try again tomorrow.`,
      remainingToday: 0
    };
  }

  // Check minute limit
  const recentCount = await client.query(
    `SELECT COUNT(*) as count 
     FROM chatbot_usage 
     WHERE student_rollno = $1 
     AND created_at > $2`,
    [studentRollno, twoMinutesAgo]
  );

  if (parseInt(recentCount.rows[0].count) >= RATE_LIMITS.MINUTE_LIMIT) {
    const lastQuery = await client.query(
      `SELECT created_at 
       FROM chatbot_usage 
       WHERE student_rollno = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [studentRollno]
    );
    
    const lastQueryTime = new Date(lastQuery.rows[0].created_at);
    const waitTime = Math.ceil((RATE_LIMITS.MINUTE_WINDOW - (now - lastQueryTime)) / 1000);
    
    return {
      allowed: false,
      reason: 'rate_limit',
      message: `Please wait ${waitTime} seconds before asking another question.`,
      waitSeconds: waitTime,
      remainingToday: RATE_LIMITS.DAILY_LIMIT - parseInt(dailyCount.rows[0].count)
    };
  }

  return {
    allowed: true,
    remainingToday: RATE_LIMITS.DAILY_LIMIT - parseInt(dailyCount.rows[0].count)
  };
};

/**
 * Ask chatbot a question
 */
export const askChatbot = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { question } = req.body;
    const { id: userId, role } = req.user;

    // Only students can use chatbot
    if (role !== 'student') {
      return res.status(403).json({
        success: false,
        message: "Chatbot is only available for students"
      });
    }

    // Validate question
    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Question is required"
      });
    }

    if (question.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Question is too long. Maximum 500 characters allowed."
      });
    }

    // Check rate limits
    const rateLimitCheck = await checkRateLimit(client, userId);
    
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: rateLimitCheck.message,
        reason: rateLimitCheck.reason,
        waitSeconds: rateLimitCheck.waitSeconds,
        remainingToday: rateLimitCheck.remainingToday
      });
    }

    // Call RAG service
    let response, tokensUsed = 0;
    
    try {
      const ragResponse = await axios.post(
        RAG_SERVICE_URL,
        {
          question: question.trim(),
          student_id: userId
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RAG_API_KEY}`
          },
          timeout: 30000 // 30 second timeout
        }
      );

      response = ragResponse.data.answer || ragResponse.data.response || "I couldn't generate a response.";
      tokensUsed = ragResponse.data.tokens_used || 0;

    } catch (ragError) {
      console.error("RAG Service Error:", ragError.message);
      
      // Fallback response if RAG service fails
      response = "I'm currently unable to process your question. Please try again later.";
      
      // Don't count failed requests against rate limit
      return res.status(503).json({
        success: false,
        message: "Chatbot service is temporarily unavailable",
        error: "service_unavailable"
      });
    }

    // Log the interaction
    await client.query(
      `INSERT INTO chatbot_usage (student_rollno, question, response, tokens_used)
       VALUES ($1, $2, $3, $4)`,
      [userId, question.trim(), response, tokensUsed]
    );

    // Update daily stats
    await client.query(
      `INSERT INTO chatbot_daily_stats (date, total_questions, total_students, total_tokens)
       VALUES (CURRENT_DATE, 1, 1, $1)
       ON CONFLICT (date) 
       DO UPDATE SET 
         total_questions = chatbot_daily_stats.total_questions + 1,
         total_tokens = chatbot_daily_stats.total_tokens + $1`,
      [tokensUsed]
    );

    res.status(200).json({
      success: true,
      data: {
        question: question.trim(),
        answer: response,
        remainingToday: rateLimitCheck.remainingToday - 1,
        dailyLimit: RATE_LIMITS.DAILY_LIMIT
      }
    });

  } catch (error) {
    console.error("Chatbot Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process your question",
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Get chatbot usage stats for student
 */
export const getChatbotStats = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id: userId, role } = req.user;

    if (role !== 'student') {
      return res.status(403).json({
        success: false,
        message: "Only students can view chatbot stats"
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // Get today's usage
    const todayUsage = await client.query(
      `SELECT COUNT(*) as count 
       FROM chatbot_usage 
       WHERE student_rollno = $1 
       AND DATE(created_at) = $2`,
      [userId, today]
    );

    // Get total usage
    const totalUsage = await client.query(
      `SELECT COUNT(*) as count 
       FROM chatbot_usage 
       WHERE student_rollno = $1`,
      [userId]
    );

    // Get recent questions
    const recentQuestions = await client.query(
      `SELECT question, response, created_at 
       FROM chatbot_usage 
       WHERE student_rollno = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [userId]
    );

    // Check if can ask now
    const rateLimitCheck = await checkRateLimit(client, userId);

    res.status(200).json({
      success: true,
      data: {
        todayUsage: parseInt(todayUsage.rows[0].count),
        totalUsage: parseInt(totalUsage.rows[0].count),
        dailyLimit: RATE_LIMITS.DAILY_LIMIT,
        remainingToday: rateLimitCheck.allowed ? rateLimitCheck.remainingToday : 0,
        canAskNow: rateLimitCheck.allowed,
        waitSeconds: rateLimitCheck.waitSeconds || 0,
        recentQuestions: recentQuestions.rows
      }
    });

  } catch (error) {
    console.error("Error fetching chatbot stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chatbot statistics",
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Get chatbot history for student
 */
export const getChatbotHistory = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id: userId, role } = req.user;
    const { limit = 20, offset = 0 } = req.query;

    if (role !== 'student') {
      return res.status(403).json({
        success: false,
        message: "Only students can view chatbot history"
      });
    }

    const history = await client.query(
      `SELECT id, question, response, created_at 
       FROM chatbot_usage 
       WHERE student_rollno = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const totalCount = await client.query(
      `SELECT COUNT(*) as count 
       FROM chatbot_usage 
       WHERE student_rollno = $1`,
      [userId]
    );

    res.status(200).json({
      success: true,
      data: {
        history: history.rows,
        total: parseInt(totalCount.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error("Error fetching chatbot history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chatbot history",
      error: error.message
    });
  } finally {
    client.release();
  }
};
