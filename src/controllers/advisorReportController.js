import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import pool from "../config/database.js";
import redisClient from "../config/redis.js";

export const downloadAdvisorReport = async (req, res) => {
  try {
    const { type, month, academic_year, format } = req.query;
    const teacherId = req.user.id;

    if (!type || !academic_year || !format) {
      return res.status(400).json({ message: "Missing parameters" });
    }

    // 🔐 VERIFY ADVISOR
    const advisorResult = await pool.query(
      `SELECT c.class_id, c.year, c.branch
       FROM advisors a
       JOIN classes c ON c.class_id = a.class_id
       WHERE a.teacher_id = $1`,
      [teacherId]
    );

    if (advisorResult.rowCount === 0) {
      return res.status(403).json({ message: "Only advisor allowed" });
    }

    const { class_id, year, branch } = advisorResult.rows[0];
    const divisionName = `${year}-${branch}`;

    // 👨‍🎓 GET STUDENTS
    const studentsResult = await pool.query(
      `SELECT student_rollno, name
       FROM students
       WHERE class_id = $1
       ORDER BY student_rollno`,
      [class_id]
    );

    const students = studentsResult.rows;

    // 📚 GET SUBJECTS WITH NAMES
    const subjectsResult = await pool.query(
      `
      SELECT DISTINCT s.subject_id, s.subject_name
      FROM subjects s
      WHERE s.subject_id IN (
          SELECT subject_id
          FROM attendance_manual_summary
          WHERE academic_year = $1

          UNION

          SELECT t.subject_id
          FROM attendance a
          JOIN timetable t ON t.timetable_id = a.timetable_id
          WHERE a.submitted = true
          AND t.class_id = $2
          AND t.academic_year = $1
      )
      ORDER BY s.subject_name
      `,
      [academic_year, class_id]
    );

    const subjects = subjectsResult.rows; // contains id + name

    // ======================
    // ATTENDANCE QUERY
    // ======================
    let attendanceQuery;
    let params;

    if (type === "monthly") {

      if (!month) {
        return res.status(400).json({ message: "Month required" });
      }

      if (Number(month) === 1) {
        attendanceQuery = `
          SELECT a.student_rollno, a.subject_id,
                 a.total_lectures AS total,
                 a.attended_lectures AS present
          FROM attendance_manual_summary a
          JOIN students s ON s.student_rollno = a.student_rollno
          WHERE a.academic_year = $1
          AND a.month = $2
          AND s.class_id = $3
        `;
        params = [academic_year, month, class_id];

      } else {
        attendanceQuery = `
          SELECT a.student_rollno, t.subject_id,
                 SUM(t.duration) AS total,
                 SUM(CASE WHEN a.status='Present'
                          THEN t.duration ELSE 0 END) AS present
          FROM attendance a
          JOIN timetable t ON t.timetable_id = a.timetable_id
          WHERE a.submitted = true
          AND t.class_id = $1
          AND t.academic_year = $2
          AND EXTRACT(MONTH FROM a.attendance_date) = $3
          GROUP BY a.student_rollno, t.subject_id
        `;
        params = [class_id, academic_year, month];
      }

    } else {

      attendanceQuery = `
        SELECT student_rollno, subject_id,
               SUM(total) AS total,
               SUM(present) AS present
        FROM (
           SELECT a.student_rollno, a.subject_id,
                  a.total_lectures AS total,
                  a.attended_lectures AS present
           FROM attendance_manual_summary a
           JOIN students s ON s.student_rollno = a.student_rollno
           WHERE a.academic_year = $1
           AND s.class_id = $2

           UNION ALL

           SELECT a.student_rollno, t.subject_id,
                  t.duration,
                  CASE WHEN a.status='Present'
                       THEN t.duration ELSE 0 END
           FROM attendance a
           JOIN timetable t ON t.timetable_id = a.timetable_id
           WHERE a.submitted = true
           AND t.class_id = $2
           AND t.academic_year = $1
        ) merged
        GROUP BY student_rollno, subject_id
      `;

      params = [academic_year, class_id];
    }

    const attendanceResult = await pool.query(attendanceQuery, params);

    // ======================
    // TRANSFORM DATA
    // ======================
    const matrix = {};

    students.forEach(s => {
      matrix[s.student_rollno] = {
        name: s.name,
        subjects: {},
        avg: 0
      };
    });

    attendanceResult.rows.forEach(row => {
      const percentage =
        row.total > 0
          ? Math.round((row.present / row.total) * 100)
          : 0;

      if (matrix[row.student_rollno]) {
        matrix[row.student_rollno].subjects[row.subject_id] = percentage;
      }
    });

    Object.keys(matrix).forEach(roll => {
      const values = Object.values(matrix[roll].subjects);
      matrix[roll].avg =
        values.length > 0
          ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
          : 0;
    });

    // ======================
    // PDF EXPORT
    // ======================
    if (format === "pdf") {
if (!subjects || subjects.length === 0) {
  return res.status(400).json({
    message: "No subjects found for selected criteria"
  });
}
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 30
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${divisionName}-${type}.pdf`
      );

      doc.pipe(res);

      doc.font("Helvetica-Bold")
         .fontSize(16)
         .text("Attendance Report", { align: "center" });

      doc.moveDown(0.3);

      doc.font("Helvetica")
         .fontSize(12)
         .text(
           `${month ? `Month: ${month}` : "Overall"}  |  Academic Year: ${academic_year}`,
           { align: "center" }
         );

      doc.moveDown(2);

      const startX = 30;
      let y = doc.y;
      const rowHeight = 25;


      const pageWidth = doc.page.width - 60;


      const srWidth = 40;
      const rollWidth = 60;
      const nameWidth = 180;
      const avgWidth = 60;

      const remainingWidth =
        pageWidth - (srWidth + rollWidth + nameWidth + avgWidth);

      const subjectWidth = remainingWidth / subjects.length;

      const widths = [
        srWidth,
        rollWidth,
        nameWidth,
        ...subjects.map(() => subjectWidth),
        avgWidth
      ];

      const totalTableWidth =
        srWidth + rollWidth + nameWidth +
        subjects.length * subjectWidth + avgWidth;

      const tableTopY = y;

      let x = startX;

      doc.font("Helvetica-Bold").fontSize(10);

      // Header Row 1
      doc.rect(x, y, srWidth, rowHeight * 2).stroke();
      doc.text("SR\nNO", x, y + 8, { width: srWidth, align: "center" });
      x += srWidth;

      doc.rect(x, y, rollWidth, rowHeight * 2).stroke();
      doc.text("ROLL\nNO", x, y + 8, { width: rollWidth, align: "center" });
      x += rollWidth;

      doc.rect(x, y, nameWidth, rowHeight * 2).stroke();
      doc.text("NAME OF THE STUDENT", x, y + 15, {
        width: nameWidth,
        align: "center"
      });
      x += nameWidth;

      const subjectHeaderWidth = subjects.length * subjectWidth;
      doc.rect(x, y, subjectHeaderWidth, rowHeight).stroke();
      doc.text("SUBJECT % ATTENDANCE", x, y + 8, {
        width: subjectHeaderWidth,
        align: "center"
      });
      x += subjectHeaderWidth;

      doc.rect(x, y, avgWidth, rowHeight * 2).stroke();
      doc.text("AVG", x, y + 15, { width: avgWidth, align: "center" });

      y += rowHeight;

      // Header Row 2
      x = startX + srWidth + rollWidth + nameWidth;

      subjects.forEach(sub => {
        doc.rect(x, y, subjectWidth, rowHeight).stroke();
        doc.text(sub.subject_name, x, y + 8, {
          width: subjectWidth,
          align: "center"
        });
        x += subjectWidth;
      });

      y += rowHeight;

      doc.font("Helvetica").fontSize(9);

      let sr = 1;

      Object.keys(matrix).forEach(roll => {

        if (y > 520) {
          doc.addPage();
          y = 40;
        }

        let x = startX;
        const student = matrix[roll];

        const rowData = [
          sr++,
          roll,
          student.name,
          ...subjects.map(sub =>
            student.subjects[sub.subject_id] ?? 0
          ),
          student.avg
        ];

        rowData.forEach((cell, i) => {

          doc.rect(x, y, widths[i], rowHeight).stroke();

          if (i > 2 && cell < 75) {
            doc.fillColor("red");
          }

          doc.text(cell, x, y + 8, {
            width: widths[i],
            align: "center"
          });

          doc.fillColor("black");
          x += widths[i];
        });

        y += rowHeight;
      });

      const tableBottomY = y;

      doc.lineWidth(2);
      doc.rect(
        startX,
        tableTopY,
        totalTableWidth,
        tableBottomY - tableTopY
      ).stroke();
      doc.lineWidth(1);

      doc.end();
      return;
    }

    // ======================
    // EXCEL EXPORT
    // ======================
    else {

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Attendance");

      const header = [
        "Sr",
        "Roll",
        "Name",
        ...subjects.map(s => s.subject_name),
        "AVG"
      ];

      sheet.addRow(header);

      let sr = 1;

      Object.keys(matrix).forEach(roll => {

        const student = matrix[roll];

        const row = [
          sr++,
          roll,
          student.name,
          ...subjects.map(sub =>
            student.subjects[sub.subject_id] ?? 0
          ),
          student.avg
        ];

        const addedRow = sheet.addRow(row);

        addedRow.eachCell((cell, colNumber) => {
          if (colNumber > 3 && cell.value < 75) {
            cell.font = { color: { argb: "FFFF0000" } };
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${divisionName}-${type}.xlsx`
      );

      return res.send(buffer);
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error generating report" });
  }
};
