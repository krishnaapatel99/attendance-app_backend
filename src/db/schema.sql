CREATE TABLE IF NOT EXISTS teachers (
  teacher_id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL
);
CREATE TABLE IF NOT EXISTS classes (
  class_id SERIAL PRIMARY KEY,
  year VARCHAR(20) NOT NULL,      -- SE, TE, BE
  branch VARCHAR(50) NOT NULL     -- Comps-A, IT-B
);
CREATE TABLE IF NOT EXISTS students (
  student_rollno VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  class_id INT NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  email VARCHAR(100) UNIQUE ,
  password VARCHAR(255) NOT NULL
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
  batch_name VARCHAR(10) NOT NULL  -- A1, A2, A3
);
 CREATE TABLE IF NOT EXISTS student_batches (
  student_rollno VARCHAR(20) REFERENCES students(student_rollno) ON DELETE CASCADE,
  batch_id INT REFERENCES batches(batch_id) ON DELETE CASCADE,
  PRIMARY KEY (student_rollno, batch_id)
);
CREATE TABLE IF NOT EXISTS timetable (
  timetable_id SERIAL PRIMARY KEY,
  class_id INT NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  subject_id VARCHAR(20) NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  teacher_id VARCHAR(20) NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  day_of_week VARCHAR(10) CHECK (
    day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')
  ),
  lecture_no INT NOT NULL CHECK (lecture_no BETWEEN 1 AND 8),
  lecture_type VARCHAR(10) CHECK (
    lecture_type IN ('LECTURE', 'PRACTICAL')
  ) NOT NULL,
  batch_id INT REFERENCES batches(batch_id) ON DELETE SET NULL,
  academic_year VARCHAR(9) NOT NULL   -- '2024-25'
);
CREATE TABLE IF NOT EXISTS attendance (
  attendance_id SERIAL PRIMARY KEY,
  student_rollno VARCHAR(20) NOT NULL REFERENCES students(student_rollno) ON DELETE CASCADE,
  timetable_id INT NOT NULL REFERENCES timetable(timetable_id) ON DELETE CASCADE,
  status VARCHAR(10) CHECK (
    status IN ('Present', 'Absent', 'Late')
  ),
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
ALTER TABLE students
ADD COLUMN refresh_token_hash TEXT,
ADD COLUMN refresh_token_expires TIMESTAMP;

ALTER TABLE teachers
ADD COLUMN refresh_token_hash TEXT,
ADD COLUMN refresh_token_expires TIMESTAMP;


CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON timetable(teacher_id);