/* =========================
   CORE TABLES
========================= */

CREATE TABLE IF NOT EXISTS teachers (
  teacher_id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  refresh_token_hash TEXT,
  refresh_token_expires TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
  class_id SERIAL PRIMARY KEY,
  year VARCHAR(20) NOT NULL,
  branch VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  student_rollno VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  class_id INT NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  email VARCHAR(100) UNIQUE,
  email_verified BOOLEAN DEFAULT FALSE,
  password VARCHAR(255) NOT NULL,
  refresh_token_hash TEXT,
  refresh_token_expires TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subjects (
  subject_id VARCHAR(20) PRIMARY KEY,
  subject_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS teacher_subjects (
  teacher_subject_id SERIAL PRIMARY KEY,
  teacher_id VARCHAR(20) NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  subject_id VARCHAR(20) NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  UNIQUE (teacher_id, subject_id)
);

CREATE TABLE IF NOT EXISTS batches (
  batch_id SERIAL PRIMARY KEY,
  class_id INT NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  batch_name VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS student_batches (
  student_rollno VARCHAR(20) REFERENCES students(student_rollno) ON DELETE CASCADE,
  batch_id INT REFERENCES batches(batch_id) ON DELETE CASCADE,
  PRIMARY KEY (student_rollno, batch_id)
);

/* =========================
   TIMETABLE
========================= */

CREATE TABLE IF NOT EXISTS timetable (
  timetable_id SERIAL PRIMARY KEY,
  class_id INT NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  subject_id VARCHAR(20) NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  teacher_id VARCHAR(20) NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  day_of_week VARCHAR(10) CHECK (
    day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')
  ),
  lecture_no INT NOT NULL CHECK (lecture_no BETWEEN 1 AND 8),
  lecture_type VARCHAR(10) NOT NULL CHECK (
    lecture_type IN ('LECTURE', 'PRACTICAL')
  ),
  batch_id INT REFERENCES batches(batch_id) ON DELETE SET NULL,
  academic_year VARCHAR(9) NOT NULL,
  duration INT
);

/* Backfill + enforce duration */
UPDATE timetable SET duration = 1 WHERE duration IS NULL;
ALTER TABLE timetable ALTER COLUMN duration SET DEFAULT 1;
ALTER TABLE timetable ALTER COLUMN duration SET NOT NULL;

/* Unique teacher slot constraint (safe) */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uniq_teacher_day_slot'
  ) THEN
    ALTER TABLE timetable
    ADD CONSTRAINT uniq_teacher_day_slot
    UNIQUE (teacher_id, day_of_week, lecture_no);
  END IF;
END $$;

/* =========================
   ATTENDANCE
========================= */

CREATE TABLE IF NOT EXISTS attendance (
  attendance_id SERIAL PRIMARY KEY,
  student_rollno VARCHAR(20) NOT NULL REFERENCES students(student_rollno) ON DELETE CASCADE,
  timetable_id INT NOT NULL REFERENCES timetable(timetable_id) ON DELETE CASCADE,
  status VARCHAR(10) CHECK (status IN ('Present', 'Absent', 'Late')),
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  attendance_time TIME NOT NULL DEFAULT CURRENT_TIME,
  submitted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_attendance UNIQUE (
    student_rollno,
    timetable_id,
    attendance_date
  )
);

/* =========================
   OTP TABLES
========================= */

CREATE TABLE IF NOT EXISTS password_otps (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('student', 'teacher')),
  otp VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_otps (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  attempts INT DEFAULT 0,
  resend_count INT DEFAULT 0,
  student_rollno VARCHAR(20) REFERENCES students(student_rollno)
);

/* =========================
   ADVISORS
========================= */

CREATE TABLE IF NOT EXISTS advisors (
  advisor_id SERIAL PRIMARY KEY,
  teacher_id VARCHAR(20) NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  class_id INT NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

/* =========================
   ANNOUNCEMENTS
========================= */

CREATE TABLE IF NOT EXISTS announcements (
  announcement_id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  author_id VARCHAR(20) NOT NULL,
  author_role VARCHAR(10) NOT NULL CHECK (author_role IN ('student', 'teacher')),
  class_id INT REFERENCES classes(class_id) ON DELETE CASCADE,
  target_audience VARCHAR(20) NOT NULL CHECK (target_audience IN ('all', 'class', 'batch')),
  batch_id INT REFERENCES batches(batch_id) ON DELETE SET NULL,
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS announcement_attachments (
  attachment_id SERIAL PRIMARY KEY,
  announcement_id INT NOT NULL REFERENCES announcements(announcement_id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  file_size INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS announcement_reads (
  read_id SERIAL PRIMARY KEY,
  announcement_id INT NOT NULL REFERENCES announcements(announcement_id) ON DELETE CASCADE,
  student_rollno VARCHAR(20) NOT NULL REFERENCES students(student_rollno) ON DELETE CASCADE,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (announcement_id, student_rollno)
);

/* =========================
   INDEXES (PERFORMANCE)
========================= */

CREATE INDEX IF NOT EXISTS idx_attendance_student_timetable_date
ON attendance (student_rollno, timetable_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_timetable_date
ON attendance (timetable_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_timetable_teacher_subject_class
ON timetable (teacher_id, subject_id, lecture_type, class_id, batch_id);

CREATE INDEX IF NOT EXISTS idx_timetable_teacher_day_lecture
ON timetable (teacher_id, day_of_week, lecture_no);

CREATE INDEX IF NOT EXISTS idx_students_class
ON students (class_id);

CREATE INDEX IF NOT EXISTS idx_batches_class
ON batches (class_id);

CREATE INDEX IF NOT EXISTS idx_student_batches_batch
ON student_batches (batch_id, student_rollno);

CREATE INDEX IF NOT EXISTS idx_attendance_timetable
ON attendance (timetable_id);

CREATE INDEX IF NOT EXISTS idx_attendance_student_submitted
ON attendance (student_rollno, submitted, timetable_id);

CREATE INDEX IF NOT EXISTS idx_timetable_analytics
ON timetable (subject_id, lecture_type, class_id, batch_id, timetable_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_advisor_class
ON advisors (class_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_advisor_teacher_class
ON advisors (teacher_id, class_id);

/* =========================
   ANNOUNCEMENT INDEXES
========================= */

CREATE INDEX IF NOT EXISTS idx_announcements_class
ON announcements (class_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_author
ON announcements (author_id, author_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_batch
ON announcements (batch_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_student
ON announcement_reads (student_rollno, announcement_id);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement
ON announcement_reads (announcement_id, student_rollno);

/* =========================
   CHATBOT TABLES
========================= */

-- Chatbot usage tracking table
CREATE TABLE IF NOT EXISTS chatbot_usage (
    id SERIAL PRIMARY KEY,
    student_rollno VARCHAR(50) NOT NULL,
    question TEXT NOT NULL,
    response TEXT,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_rollno) REFERENCES students(student_rollno) ON DELETE CASCADE
);

-- Chatbot daily usage summary (for analytics)
CREATE TABLE IF NOT EXISTS chatbot_daily_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_questions INTEGER DEFAULT 0,
    total_students INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    UNIQUE(date)
);

/* =========================
   CHATBOT INDEXES
========================= */

CREATE INDEX IF NOT EXISTS idx_chatbot_usage_student 
ON chatbot_usage(student_rollno);

CREATE INDEX IF NOT EXISTS idx_chatbot_usage_created_at 
ON chatbot_usage(created_at);

CREATE INDEX IF NOT EXISTS idx_chatbot_usage_student_date 
ON chatbot_usage(student_rollno, created_at);

CREATE INDEX IF NOT EXISTS idx_chatbot_daily_stats_date 
ON chatbot_daily_stats(date);
