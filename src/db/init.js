import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import pool from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDB() {
  const client = await pool.connect();

  try {
    console.log("🚀 Initializing database...");
    await client.query("BEGIN");

    /* =========================
       1️⃣ RUN FULL SCHEMA
    ========================= */
    const schema = fs.readFileSync(
      path.join(__dirname, "schema.sql"),
      "utf-8"
    );
    await client.query(schema);
    console.log("✅ Schema executed");

    /* =========================
       2️⃣ TEACHERS
    ========================= */
//     const teachers = [
//       ["Dr. Krishna Singhal", "krishna.singal@ltce.in"],
//       ["Prof. Neha Verma", "neha@college.edu"],
//       ["Prof. Rahul Patil", "rahul@college.edu"],
//       ["Dr. Sneha Kulkarni", "sneha@college.edu"],
//       ["Prof. Kiran Joshi", "kiran@college.edu"]
//     ];

//     for (const [name, email] of teachers) {
//       const hash = await bcrypt.hash("Teacher123", 10);
//       await client.query(
//         `INSERT INTO teachers (name,email,password)
//          VALUES ($1,$2,$3)
//          ON CONFLICT (email) DO NOTHING`,
//         [name, email, hash]
//       );
//     }

//     /* =========================
//        3️⃣ CLASSES
//     ========================= */
//     const classes = [
//       ["SE", "Comps-A"],
//       ["SE", "IT-B"],
//       ["TE", "Comps-A"],
//       ["BE", "Comps-A"]
//     ];

//     for (const c of classes) {
//       await client.query(
//         `INSERT INTO classes (year,branch)
//          VALUES ($1,$2)
//          ON CONFLICT DO NOTHING`,
//         c
//       );
//     }

//     /* =========================
//        4️⃣ STUDENTS
//     ========================= */
//     const students = [
//       ["Krishna Patel", "krishnapatel_comp_2024@ltce.in", "SE", "Comps-A"],
//       ["Aman Joshi", "aman@college.edu", "SE", "Comps-A"],
//       ["Riya Mehta", "riya@college.edu", "SE", "Comps-A"],
//       ["Snehal Deshmukh", "snehal@college.edu", "SE", "IT-B"],
//       ["Rohit Kale", "rohit@college.edu", "SE", "IT-B"],
//       ["Aditya Singh", "aditya@college.edu", "TE", "Comps-A"],
//       ["Pooja Nair", "pooja@college.edu", "TE", "Comps-A"],
//       ["Omkar Kulkarni", "omkar@college.edu", "BE", "Comps-A"]
//     ];

//     for (const [name, email, year, branch] of students) {
//       const cls = await client.query(
//         `SELECT class_id FROM classes WHERE year=$1 AND branch=$2`,
//         [year, branch]
//       );
//       const hash = await bcrypt.hash("Password123", 10);

//       await client.query(
//         `INSERT INTO students (name,email,password,class_id)
//          VALUES ($1,$2,$3,$4)
//          ON CONFLICT (email) DO NOTHING`,
//         [name, email, hash, cls.rows[0].class_id]
//       );
//     }

//     /* =========================
//        5️⃣ SUBJECTS
//     ========================= */
//     const subjects = [
//       "Data Structures",
//       "DBMS",
//       "Operating Systems",
//       "Computer Networks",
//       "Machine Learning"
//     ];

//     for (const subject of subjects) {
//       await client.query(
//         `INSERT INTO subjects (subject_name)
//          VALUES ($1)
//          ON CONFLICT DO NOTHING`,
//         [subject]
//       );
//     }

//     /* =========================
//        6️⃣ TEACHER ↔ SUBJECT (M:N)
//     ========================= */
//     await client.query(`
//       INSERT INTO teacher_subjects (teacher_id, subject_id)
//       SELECT t.teacher_id, s.subject_id
//       FROM teachers t, subjects s
//       WHERE
//         (t.email='amit@college.edu' AND s.subject_name IN ('Data Structures','Operating Systems'))
//         OR (t.email='neha@college.edu' AND s.subject_name IN ('DBMS','Data Structures'))
//         OR (t.email='rahul@college.edu' AND s.subject_name='Computer Networks')
//         OR (t.email='sneha@college.edu' AND s.subject_name='Machine Learning')
//         OR (t.email='kiran@college.edu' AND s.subject_name='DBMS')
//       ON CONFLICT DO NOTHING
//     `);

//     /* =========================
//        7️⃣ BATCHES
//     ========================= */
//     await client.query(`
//       INSERT INTO batches (class_id,batch_name)
//       SELECT c.class_id, b.batch
//       FROM classes c,
//            (VALUES ('SE','Comps-A','A1'),('SE','Comps-A','A2'),
//                    ('SE','IT-B','B1'),
//                    ('TE','Comps-A','A1'),('TE','Comps-A','A2'),
//                    ('BE','Comps-A','A1')) AS b(year,branch,batch)
//       WHERE c.year=b.year AND c.branch=b.branch
//       ON CONFLICT DO NOTHING
//     `);

//     /* =========================
//        8️⃣ STUDENT ↔ BATCH
//     ========================= */
//     await client.query(`
//       INSERT INTO student_batches (student_rollno,batch_id)
//       SELECT s.student_rollno, b.batch_id
//       FROM students s
//       JOIN batches b ON b.class_id=s.class_id
//       WHERE
//         (s.name IN ('Krishna Patil','Aman Joshi') AND b.batch_name='A1')
//         OR (s.name='Riya Mehta' AND b.batch_name='A2')
//         OR (s.name IN ('Snehal Deshmukh','Rohit Kale'))
//         OR (s.name='Aditya Singh' AND b.batch_name='A1')
//         OR (s.name='Pooja Nair' AND b.batch_name='A2')
//         OR (s.name='Omkar Kulkar')
//       ON CONFLICT DO NOTHING
//     `);

//     /* =========================
//        9️⃣ TIMETABLE (MULTI CLASS)
//     ========================= */
//     await client.query(`
//       INSERT INTO timetable
// (class_id, subject_id, teacher_id, day_of_week, lecture_no, lecture_type, batch_id, academic_year)
// SELECT
//   c.class_id,
//   s.subject_id,
//   ts.teacher_id,
//   d.day,
//   d.lecture,
//   d.type,
//   CASE 
//     WHEN d.type = 'PRACTICAL' THEN b.batch_id
//     ELSE NULL
//   END,
//   '2024-25'
// FROM (
//   VALUES
//     ('SE','Comps-A','Data Structures','Monday',1,'LECTURE'),
//     ('SE','Comps-A','Data Structures','Tuesday',5,'PRACTICAL'),
//     ('TE','Comps-A','DBMS','Wednesday',2,'LECTURE'),
//     ('BE','Comps-A','Machine Learning','Thursday',6,'PRACTICAL')
// ) AS d(year, branch, subject, day, lecture, type)
// JOIN classes c
//   ON c.year = d.year AND c.branch = d.branch
// JOIN subjects s
//   ON s.subject_name = d.subject
// JOIN teacher_subjects ts
//   ON ts.subject_id = s.subject_id
// LEFT JOIN batches b
//   ON b.class_id = c.class_id
//  AND d.type = 'PRACTICAL';
//     `);

    await client.query("COMMIT");
    console.log("🎉 Database initialized successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Init failed:", err);
  } finally {
    client.release();
  }
}

export default initDB;

if (import.meta.url === `file://${process.argv[1]}`) {
  initDB();
}
