import pool from "../config/database.js";

// Create announcement
export const createAnnouncement = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { title, content, target_audience, batch_id, priority } = req.body;
    const { userId, role } = req.user;

    if (!title || !content || !target_audience) {
      return res.status(400).json({
        success: false,
        message: "Title, content, and target audience are required"
      });
    }

    // Get user's class_id
    let class_id = null;
    if (role === 'student') {
      const studentQuery = await client.query(
        'SELECT class_id FROM students WHERE student_rollno = $1',
        [userId]
      );
      if (studentQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Student not found"
        });
      }
      class_id = studentQuery.rows[0].class_id;
    } else if (role === 'teacher') {
      // For teachers, class_id should be provided or get from advisor
      if (target_audience === 'class' || target_audience === 'batch') {
        const advisorQuery = await client.query(
          'SELECT class_id FROM advisors WHERE teacher_id = $1 LIMIT 1',
          [userId]
        );
        if (advisorQuery.rows.length > 0) {
          class_id = advisorQuery.rows[0].class_id;
        }
      }
    }

    const result = await client.query(
      `INSERT INTO announcements 
       (title, content, author_id, author_role, class_id, target_audience, batch_id, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, content, userId, role, class_id, target_audience, batch_id || null, priority || 'normal']
    );

    res.status(201).json({
      success: true,
      message: "Announcement created successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Error creating announcement:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create announcement",
      error: error.message
    });
  } finally {
    client.release();
  }
};

// Get announcements for a user
export const getAnnouncements = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId, role } = req.user;
    const { limit = 50, offset = 0 } = req.query;

    let query;
    let params;

    if (role === 'student') {
      // Get student's class and batches
      const studentInfo = await client.query(
        `SELECT s.class_id, ARRAY_AGG(sb.batch_id) as batch_ids
         FROM students s
         LEFT JOIN student_batches sb ON s.student_rollno = sb.student_rollno
         WHERE s.student_rollno = $1
         GROUP BY s.class_id`,
        [userId]
      );

      if (studentInfo.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Student not found"
        });
      }

      const { class_id, batch_ids } = studentInfo.rows[0];

      query = `
        SELECT 
          a.*,
          CASE 
            WHEN a.author_role = 'student' THEN s.name
            WHEN a.author_role = 'teacher' THEN t.name
          END as author_name,
          c.year || ' ' || c.branch as class_name,
          b.batch_name,
          ar.read_at,
          (SELECT COUNT(*) FROM announcement_reads WHERE announcement_id = a.announcement_id) as read_count
        FROM announcements a
        LEFT JOIN students s ON a.author_id = s.student_rollno AND a.author_role = 'student'
        LEFT JOIN teachers t ON a.author_id = t.teacher_id AND a.author_role = 'teacher'
        LEFT JOIN classes c ON a.class_id = c.class_id
        LEFT JOIN batches b ON a.batch_id = b.batch_id
        LEFT JOIN announcement_reads ar ON a.announcement_id = ar.announcement_id AND ar.student_rollno = $1
        WHERE a.is_active = TRUE
        AND (
          a.target_audience = 'all'
          OR (a.target_audience = 'class' AND a.class_id = $2)
          OR (a.target_audience = 'batch' AND a.batch_id = ANY($3))
        )
        ORDER BY 
          CASE a.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
          END,
          a.created_at DESC
        LIMIT $4 OFFSET $5
      `;
      params = [userId, class_id, batch_ids || [], limit, offset];

    } else if (role === 'teacher') {
      // Teachers see all announcements from their classes
      query = `
        SELECT 
          a.*,
          CASE 
            WHEN a.author_role = 'student' THEN s.name
            WHEN a.author_role = 'teacher' THEN t.name
          END as author_name,
          c.year || ' ' || c.branch as class_name,
          b.batch_name,
          (SELECT COUNT(*) FROM announcement_reads WHERE announcement_id = a.announcement_id) as read_count
        FROM announcements a
        LEFT JOIN students s ON a.author_id = s.student_rollno AND a.author_role = 'student'
        LEFT JOIN teachers t ON a.author_id = t.teacher_id AND a.author_role = 'teacher'
        LEFT JOIN classes c ON a.class_id = c.class_id
        LEFT JOIN batches b ON a.batch_id = b.batch_id
        WHERE a.is_active = TRUE
        AND (
          a.author_id = $1
          OR a.target_audience = 'all'
          OR a.class_id IN (
            SELECT class_id FROM advisors WHERE teacher_id = $1
          )
        )
        ORDER BY 
          CASE a.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
          END,
          a.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [userId, limit, offset];
    }

    const result = await client.query(query, params);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error("Error fetching announcements:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch announcements",
      error: error.message
    });
  } finally {
    client.release();
  }
};

// Mark announcement as read
export const markAsRead = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { announcementId } = req.params;
    const { userId, role } = req.user;

    if (role !== 'student') {
      return res.status(403).json({
        success: false,
        message: "Only students can mark announcements as read"
      });
    }

    await client.query(
      `INSERT INTO announcement_reads (announcement_id, student_rollno)
       VALUES ($1, $2)
       ON CONFLICT (announcement_id, student_rollno) DO NOTHING`,
      [announcementId, userId]
    );

    res.status(200).json({
      success: true,
      message: "Announcement marked as read"
    });

  } catch (error) {
    console.error("Error marking announcement as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark announcement as read",
      error: error.message
    });
  } finally {
    client.release();
  }
};

// Update announcement
export const updateAnnouncement = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { announcementId } = req.params;
    const { title, content, priority, is_active } = req.body;
    const { userId, role } = req.user;

    // Check if user is the author
    const checkQuery = await client.query(
      'SELECT * FROM announcements WHERE announcement_id = $1 AND author_id = $2 AND author_role = $3',
      [announcementId, userId, role]
    );

    if (checkQuery.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own announcements"
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(content);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(announcementId);

    const result = await client.query(
      `UPDATE announcements 
       SET ${updates.join(', ')}
       WHERE announcement_id = $${paramCount}
       RETURNING *`,
      values
    );

    res.status(200).json({
      success: true,
      message: "Announcement updated successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Error updating announcement:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update announcement",
      error: error.message
    });
  } finally {
    client.release();
  }
};

// Delete announcement
export const deleteAnnouncement = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { announcementId } = req.params;
    const { userId, role } = req.user;

    // Check if user is the author
    const checkQuery = await client.query(
      'SELECT * FROM announcements WHERE announcement_id = $1 AND author_id = $2 AND author_role = $3',
      [announcementId, userId, role]
    );

    if (checkQuery.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own announcements"
      });
    }

    // Soft delete
    await client.query(
      'UPDATE announcements SET is_active = FALSE WHERE announcement_id = $1',
      [announcementId]
    );

    res.status(200).json({
      success: true,
      message: "Announcement deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting announcement:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete announcement",
      error: error.message
    });
  } finally {
    client.release();
  }
};

// Get announcement statistics (for teachers)
export const getAnnouncementStats = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId, role } = req.user;

    if (role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: "Only teachers can view announcement statistics"
      });
    }

    const stats = await client.query(
      `SELECT 
        COUNT(*) as total_announcements,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_announcements,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_announcements,
        AVG((SELECT COUNT(*) FROM announcement_reads WHERE announcement_id = a.announcement_id)) as avg_read_count
       FROM announcements a
       WHERE author_id = $1 AND author_role = 'teacher' AND is_active = TRUE`,
      [userId]
    );

    res.status(200).json({
      success: true,
      data: stats.rows[0]
    });

  } catch (error) {
    console.error("Error fetching announcement stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch announcement statistics",
      error: error.message
    });
  } finally {
    client.release();
  }
};
