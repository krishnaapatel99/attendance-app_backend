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

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_chatbot_usage_student ON chatbot_usage(student_rollno);
CREATE INDEX IF NOT EXISTS idx_chatbot_usage_created_at ON chatbot_usage(created_at);

-- Daily usage summary (for analytics)
CREATE TABLE IF NOT EXISTS chatbot_daily_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_questions INTEGER DEFAULT 0,
    total_students INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    UNIQUE(date)
);
