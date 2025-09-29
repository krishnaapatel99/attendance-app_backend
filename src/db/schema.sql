-- 1. Teachers Table
CREATE TABLE IF NOT EXISTS teachers ( 
    teacher_id SERIAL PRIMARY KEY, 
    name VARCHAR(100) NOT NULL, 
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL 
);

-- 2. Students Table 
CREATE TABLE IF NOT EXISTS students ( 
    student_rollno SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,  
    class VARCHAR(50) NOT NULL,
    div VARCHAR(10) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL 
);

-- 3. Subjects Table 
CREATE TABLE IF NOT EXISTS subjects ( 
    subject_id SERIAL PRIMARY KEY, 
    subject_name VARCHAR(100) NOT NULL, 
    teacher_id INT NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE 
);

-- 4. Timetable Table 
CREATE TABLE IF NOT EXISTS timetable ( 
    timetable_id SERIAL PRIMARY KEY, 
    class_name VARCHAR(50) NOT NULL, 
    subject_id INT NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE, 
    teacher_id INT NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE, 
    day_of_week VARCHAR(10) CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')), 
    lecture_no INT NOT NULL CHECK (lecture_no BETWEEN 1 AND 8)
);

-- 5. Attendance Table 
CREATE TABLE IF NOT EXISTS attendance ( 
    attendance_id SERIAL PRIMARY KEY, 
    student_rollno INT NOT NULL REFERENCES students(student_rollno) ON DELETE CASCADE, 
    subject_id INT NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE, 
    teacher_id INT NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE, 
    timetable_id INT NOT NULL REFERENCES timetable(timetable_id) ON DELETE CASCADE, 
    status VARCHAR(10) CHECK (status IN ('Present', 'Absent', 'Late')), 
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE, 
    attendance_time TIME NOT NULL DEFAULT CURRENT_TIME, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted BOOLEAN DEFAULT FALSE, 
    CONSTRAINT unique_attendance_per_day UNIQUE (student_rollno, subject_id, attendance_date, timetable_id) 
);