import pool from "../config/database.js";
import bcrypt from "bcrypt";

// Student dummy data
const students = [
  {
    name: "Krishna Patel",
    class: "SE",
    div: "A",
    email: "krishnapatel_comp_2024@ltce.in",
    password: "Password123"
  },
  {
    name: "Sahil Kadam",
    class: "SE", 
    div: "A",
    email: "sahilkadam_comp_2024@ltce.in",
    password: "Password123"
  },
  {
    name: "Kushal Dubey",
    class: "SE",
    div: "A", 
    email: "kushaldubey_comp_2024@ltce.in",
    password: "Password123"
  },
  {
    name: "Dewarat Singh",
    class: "SE",
    div: "A",
    email: "dewaratsingh_comp_2024@ltce.in", 
    password: "Password123"
  },
  {
    name: "Rajesh Kumar",
    class: "SE",
    div: "B",
    email: "rajeshkumar_comp_2024@ltce.in",
    password: "Password123"
  },
  {
    name: "Priya Sharma",
    class: "SE",
    div: "B", 
    email: "priyasharma_comp_2024@ltce.in",
    password: "Password123"
  }
];

// Teacher dummy data
const teachers = [
  {
    name: "Dr. Amit Verma",
    email: "amit.verma@ltce.in",
    password: "Teacher123"
  },
  {
    name: "Prof. Sunita Singh",
    email: "sunita.singh@ltce.in", 
    password: "Teacher123"
  },
  {
    name: "Dr. Rahul Mehta",
    email: "rahul.mehta@ltce.in",
    password: "Teacher123"
  }
];

export async function insertStudents() {
  const client = await pool.connect();
  try {
    console.log("🔄 Inserting student data...");
    
    for (const student of students) {
      const hashedPassword = await bcrypt.hash(student.password, 10);
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
      console.log(`✅ Student inserted: ${student.name}`);
    }
  } catch (error) {
    console.error("❌ Error inserting students:", error);
  } finally {
    client.release();
  }
}

export async function insertTeachers() {
  const client = await pool.connect();
  try {
    console.log("🔄 Inserting teacher data...");
    
    for (const teacher of teachers) {
      const hashedPassword = await bcrypt.hash(teacher.password, 10);
      await client.query(
        `INSERT INTO teachers (name, email, password) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         password = EXCLUDED.password`,
        [teacher.name, teacher.email, hashedPassword]
      );
      console.log(`✅ Teacher inserted: ${teacher.name}`);
    }
  } catch (error) {
    console.error("❌ Error inserting teachers:", error);
  } finally {
    client.release();
  }
}

export { students, teachers };