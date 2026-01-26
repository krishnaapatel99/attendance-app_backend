import fs from "fs";
import csv from "csv-parser";
import bcrypt from "bcrypt";
import pool from "../config/database.js";

export const importStudentsFromCSV = async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ message: "CSV import disabled in prod" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "CSV file required" });
  }

  const students = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => {
      students.push(row);
    })
    .on("end", async () => {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // 🔐 Same password for all students
        const plainPassword = "Student123";
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        for (const student of students) {
          const { student_rollno, name, class_id, email } = student;

          if (!student_rollno || !name || !class_id) {
            throw new Error("Invalid CSV format");
          }

          await client.query(
            `
            INSERT INTO students
            (student_rollno, name, class_id, email, password)
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
              student_rollno.trim(),
              name.trim(),
              class_id,
              email || null,
              hashedPassword,
            ]
          );
        }

        await client.query("COMMIT");

        res.json({
          message: "Students imported successfully",
          count: students.length,
          defaultPassword: "Student123",
        });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).json({ message: "CSV import failed" });
      } finally {
        client.release();
        fs.unlinkSync(req.file.path);
      }
    });
};
