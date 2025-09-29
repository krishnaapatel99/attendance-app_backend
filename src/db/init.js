// src/db/init.js
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
    console.log("🔄 Initializing database...");
    
    // Test database connection
    const connectionTest = await client.query('SELECT NOW()');
    console.log("✅ Database connection successful:", connectionTest.rows[0].now);

    // Load schema.sql file (same folder as init.js)
    const schemaPath = path.join(__dirname, "schema.sql");
    console.log("📁 Reading schema from:", schemaPath);
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }
    
    const schema = fs.readFileSync(schemaPath, "utf-8");
    console.log("📄 Schema file loaded successfully");

    // Extract CREATE TABLE statements using regex
    const createTableRegex = /CREATE TABLE IF NOT EXISTS \w+[\s\S]*?\);/gi;
    const queries = schema.match(createTableRegex) || [];

    console.log(`🔍 Found ${queries.length} SQL queries to execute`);

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i].trim();
      try {
        console.log(`⚡ Executing query ${i + 1}/${queries.length}`);
        await client.query(query);
        
        // Extract table name if it's a CREATE TABLE query
        if (/CREATE TABLE/i.test(query)) {
          const match = query.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i);
          if (match) {
            console.log(`✅ Table created/verified: ${match[1]}`);
          }
        }
      } catch (queryError) {
        console.error(`❌ Error executing query ${i + 1}:`, queryError.message);
        console.error("Query:", query);
        throw queryError;
      }
    }

    // Insert dummy students data with hashed passwords
    const studentDummyData = [
      {
        name: 'Krishna Patel',
        class: 'SE',
        div: 'A',
        email: 'krishnapatel_comp_2024@ltce.in',
        password: 'Password123'
      },
      {
        name: 'Sahil Kadam',
        class: 'SE',
        div: 'A',
        email: 'sahilkadam_comp_2024@ltce.in',
        password: 'Password123'
      },
      {
        name: 'Kushal Dubey',
        class: 'SE',
        div: 'A',
        email: 'kushaldubey_comp_2024@ltce.in',
        password: 'Password123'
      },
      {
        name: 'Dewarat Singh',
        class: 'SE',
        div: 'A',
        email: 'dewaratsingh_comp_2024@ltce.in',
        password: 'Password123'
      }
    ];

    console.log("🔄 Inserting student dummy data...");
    
    for (const student of studentDummyData) {
      try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(student.password, 10);
        
        // Insert student with hashed password
        await client.query(
          `INSERT INTO students (name, class, div, email, password)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           class = EXCLUDED.class,
           div = EXCLUDED.div,
           password = EXCLUDED.password`,
          [student.name, student.class, student.div, student.email, hashedPassword]
        );
        console.log(`✅ Student inserted/updated: ${student.name} (${student.email})`);
      } catch (studentError) {
        console.error(`❌ Error inserting student ${student.name}:`, studentError.message);
      }
    }

    // Insert dummy teacher data
    const teacherDummyData = [
      {
        name: 'Dr. Krishna Singal',
        email: 'krishna.singal@ltce.in',
        password: 'Teacher123'
      },
      {
        name: 'Prof. Sanjay D. Naravadkar',
        email: 'sanjay.naravadkar@ltce.in',
        password: 'Teacher123'
      },
      {
        name: 'Dr. Smita A. Attarde',
        email: 'smita.attarde@ltce.in',
        password: 'Teacher123'
      },
      {
        name: 'Prof. Asif Sayyad',
        email: 'asif.sayyad@ltce.in',
        password: 'Teacher123'
      },
      {
        name: 'Prof. Shivani Awasthi',
        email: 'shivani.awasthi@ltce.in',
        password: 'Teacher123'
      },
      {
        name: 'Prof. Pranjali V. Gurnule',
        email: 'pranjali.gurnule@ltce.in',
        password: 'Teacher123'
      },
      {
        name: 'Prof. Shital K. Dhamal',
        email: 'shital.dhamal@ltce.in',
        password: 'Teacher123'
      },
      {
        name: 'Prof. Chitra S. Ramteke',
        email: 'chitra.ramteke@ltce.in',
        password: 'Teacher123'
      }
    ];

    console.log("🔄 Inserting teacher dummy data...");
    
    for (const teacher of teacherDummyData) {
      try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(teacher.password, 10);
        
        // Insert teacher with hashed password
        await client.query(
          `INSERT INTO teachers (name, email, password)
           VALUES ($1, $2, $3)
           ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           password = EXCLUDED.password`,
          [teacher.name, teacher.email, hashedPassword]
        );
        console.log(`✅ Teacher inserted/updated: ${teacher.name} (${teacher.email})`);
      } catch (teacherError) {
        console.error(`❌ Error inserting teacher ${teacher.name}:`, teacherError.message);
      }
    }

    // Insert dummy subjects data
    const subjectDummyData = [
      {
        subject_name: 'Mathematics for Computer Science (MCS)',
        teacher_email: 'krishna.singal@ltce.in'
      },
      {
        subject_name: 'Computer Organization and Architecture (COA)',
        teacher_email: 'sanjay.naravadkar@ltce.in'
      },
      {
        subject_name: 'Analysis of Algorithm (AOA)',
        teacher_email: 'smita.attarde@ltce.in'
      },
      {
        subject_name: 'Open Elective-I: Indian Constitution and Governance (OE-I)',
        teacher_email: 'asif.sayyad@ltce.in'
      },
      {
        subject_name: 'Entrepreneurship & Financial Management (EFM)',
        teacher_email: 'shivani.awasthi@ltce.in'
      },
      {
        subject_name: 'Entrepreneurship & Sustainability (E&S)',
        teacher_email: 'pranjali.gurnule@ltce.in'
      },
      {
        subject_name: 'Full Stack Java Programming (FSJP)',
        teacher_email: 'shital.dhamal@ltce.in'
      },
      {
        subject_name: 'Computer Organization and Architecture Lab (COAL)',
        teacher_email: 'sanjay.naravadkar@ltce.in'
      },
      {
        subject_name: 'Analysis of Algorithm Lab (AOAL)',
        teacher_email: 'smita.attarde@ltce.in'
      },
      {
        subject_name: 'Full Stack Java Programming Lab (FSJPL)',
        teacher_email: 'shital.dhamal@ltce.in'
      }
    ];

    console.log("🔄 Inserting subject dummy data...");
    
    for (const subject of subjectDummyData) {
      try {
        // Get teacher ID by email
        const teacherResult = await client.query(
          'SELECT teacher_id FROM teachers WHERE email = $1',
          [subject.teacher_email]
        );
        
        if (teacherResult.rows.length > 0) {
          const teacherId = teacherResult.rows[0].teacher_id;
          await client.query(
            `INSERT INTO subjects (subject_name, teacher_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [subject.subject_name, teacherId]
          );
          console.log(`✅ Subject inserted: ${subject.subject_name}`);
        } else {
          console.error(`❌ Teacher not found for subject ${subject.subject_name}: ${subject.teacher_email}`);
        }
      } catch (subjectError) {
        console.error(`❌ Error inserting subject ${subject.subject_name}:`, subjectError.message);
      }
    }

    // Insert dummy timetable data
    const timetableDummyData = [
      // Monday
      { class_name: 'SE', subject_name: 'Entrepreneurship & Sustainability (E&S)', day_of_week: 'Monday', lecture_no: 1 },
      { class_name: 'SE', subject_name: 'Entrepreneurship & Financial Management (EFM)', day_of_week: 'Monday', lecture_no: 2 },
      { class_name: 'SE', subject_name: 'Analysis of Algorithm (AOA)', day_of_week: 'Monday', lecture_no: 3 },
      { class_name: 'SE', subject_name: 'Mathematics for Computer Science (MCS)', day_of_week: 'Monday', lecture_no: 4 },
      { class_name: 'SE', subject_name: 'Analysis of Algorithm Lab (AOAL)', day_of_week: 'Monday', lecture_no: 5 },
      { class_name: 'SE', subject_name: 'Full Stack Java Programming Lab (FSJPL)', day_of_week: 'Monday', lecture_no: 6 },
      { class_name: 'SE', subject_name: 'Computer Organization and Architecture Lab (COAL)', day_of_week: 'Monday', lecture_no: 7 },
      
      // Tuesday
      { class_name: 'SE', subject_name: 'Mathematics for Computer Science (MCS)', day_of_week: 'Tuesday', lecture_no: 1 },
      { class_name: 'SE', subject_name: 'Full Stack Java Programming (FSJP)', day_of_week: 'Tuesday', lecture_no: 2 },
      { class_name: 'SE', subject_name: 'Entrepreneurship & Sustainability (E&S)', day_of_week: 'Tuesday', lecture_no: 3 },
      { class_name: 'SE', subject_name: 'Open Elective-I: Indian Constitution and Governance (OE-I)', day_of_week: 'Tuesday', lecture_no: 4 },
      { class_name: 'SE', subject_name: 'Analysis of Algorithm (AOA)', day_of_week: 'Tuesday', lecture_no: 5 },
      
      // Wednesday
      { class_name: 'SE', subject_name: 'Analysis of Algorithm (AOA)', day_of_week: 'Wednesday', lecture_no: 1 },
      { class_name: 'SE', subject_name: 'Mathematics for Computer Science (MCS)', day_of_week: 'Wednesday', lecture_no: 2 },
      { class_name: 'SE', subject_name: 'Full Stack Java Programming (FSJP)', day_of_week: 'Wednesday', lecture_no: 3 },
      { class_name: 'SE', subject_name: 'Open Elective-I: Indian Constitution and Governance (OE-I)', day_of_week: 'Wednesday', lecture_no: 4 },
      { class_name: 'SE', subject_name: 'Computer Organization and Architecture (COA)', day_of_week: 'Wednesday', lecture_no: 5 },
      
      // Thursday
      { class_name: 'SE', subject_name: 'Entrepreneurship & Financial Management (EFM)', day_of_week: 'Thursday', lecture_no: 1 },
      { class_name: 'SE', subject_name: 'Computer Organization and Architecture (COA)', day_of_week: 'Thursday', lecture_no: 2 },
      { class_name: 'SE', subject_name: 'Open Elective-I: Indian Constitution and Governance (OE-I)', day_of_week: 'Thursday', lecture_no: 4 },
      { class_name: 'SE', subject_name: 'Full Stack Java Programming Lab (FSJPL)', day_of_week: 'Thursday', lecture_no: 5 },
      { class_name: 'SE', subject_name: 'Analysis of Algorithm Lab (AOAL)', day_of_week: 'Thursday', lecture_no: 6 },
      { class_name: 'SE', subject_name: 'Computer Organization and Architecture Lab (COAL)', day_of_week: 'Thursday', lecture_no: 7 },
      
      // Friday
      { class_name: 'SE', subject_name: 'Computer Organization and Architecture (COA)', day_of_week: 'Friday', lecture_no: 1 },
      { class_name: 'SE', subject_name: 'Computer Organization and Architecture Lab (COAL)', day_of_week: 'Friday', lecture_no: 2 },
      { class_name: 'SE', subject_name: 'Full Stack Java Programming Lab (FSJPL)', day_of_week: 'Friday', lecture_no: 3 },
      { class_name: 'SE', subject_name: 'Analysis of Algorithm Lab (AOAL)', day_of_week: 'Friday', lecture_no: 4 }
    ];

    console.log("🔄 Inserting timetable dummy data...");
    
    for (const timetable of timetableDummyData) {
      try {
        // Get subject and teacher IDs
        const subjectResult = await client.query(
          'SELECT subject_id, teacher_id FROM subjects WHERE subject_name = $1',
          [timetable.subject_name]
        );
        
        if (subjectResult.rows.length > 0) {
          const { subject_id, teacher_id } = subjectResult.rows[0];
          await client.query(
            `INSERT INTO timetable (class_name, subject_id, teacher_id, day_of_week, lecture_no)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
            [timetable.class_name, subject_id, teacher_id, timetable.day_of_week, timetable.lecture_no]
          );
          console.log(`✅ Timetable inserted: ${timetable.class_name} - ${timetable.day_of_week} Lecture ${timetable.lecture_no}`);
        } else {
          console.error(`❌ Subject not found for timetable: ${timetable.subject_name}`);
        }
      } catch (timetableError) {
        console.error(`❌ Error inserting timetable:`, timetableError.message);
      }
    }

    // Count users
    const students = await client.query("SELECT COUNT(*) FROM students");
    const teachers = await client.query("SELECT COUNT(*) FROM teachers");
    const subjects = await client.query("SELECT COUNT(*) FROM subjects");
    const timetable = await client.query("SELECT COUNT(*) FROM timetable");

    console.log(`📊 Students in DB: ${students.rows[0].count}`);
    console.log(`📊 Teachers in DB: ${teachers.rows[0].count}`);
    console.log(`📊 Subjects in DB: ${subjects.rows[0].count}`);
    console.log(`📊 Timetable entries in DB: ${timetable.rows[0].count}`);

    console.log("🎉 Database initialized successfully!");
    return true;
  } catch (err) {
    console.error("❌ Error initializing database:", err);
    console.error("Stack trace:", err.stack);
    return false;
  } finally {
    client.release();
  }
}

// Export the function for use in other files
export default initDB;

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initDB();
}
