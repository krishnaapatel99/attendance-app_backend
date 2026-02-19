import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import pool from "../config/database.js";

export const downloadAdvisorReport = async (req, res) => {
  try {
    const { type, month, academic_year, format } = req.query;
    const teacherId = req.user.id;

    if (!type || !academic_year || !format) {
      return res.status(400).json({ message: "Missing parameters" });
    }

    if (type !== "monthly") {
      return res.status(400).json({ message: "Only monthly report supported" });
    }

    if (!month) {
      return res.status(400).json({ message: "Month required" });
    }

    const isJanuary = Number(month) === 1;

    // 🔐 VERIFY ADVISOR
    const advisorResult = await pool.query(
      `SELECT c.class_id, c.year, c.branch
       FROM advisors a
       JOIN classes c ON c.class_id = a.class_id
       WHERE a.teacher_id = $1`,
      [teacherId]
    );

    if (!advisorResult.rowCount) {
      return res.status(403).json({ message: "Only advisor allowed" });
    }

    const { class_id, year, branch } = advisorResult.rows[0];
    const divisionName = `${year}-${branch}`;

    // 👨‍🎓 STUDENTS
    const studentsResult = await pool.query(
      `SELECT student_rollno, name
       FROM students
       WHERE class_id = $1
       ORDER BY student_rollno`,
      [class_id]
    );

    const students = studentsResult.rows;

    if (!students.length) {
      return res.status(400).json({ message: "No students found" });
    }

    // ======================
    // ATTENDANCE QUERY
    // ======================

    let attendanceQuery;
    let params;

    if (isJanuary) {
      // 🔹 JANUARY (OVERALL ONLY)
      attendanceQuery = `
        SELECT student_rollno,
               monthly_percentage AS percentage
        FROM monthly_attendance_summary
        WHERE academic_year = $1
        AND month = $2
        AND student_rollno IN (
            SELECT student_rollno
            FROM students
            WHERE class_id = $3
        )
      `;
      params = [academic_year, month, class_id];
    } else {
      // 🔹 OTHER MONTHS (SUBJECT WISE, LECTURE ONLY)
      attendanceQuery = `
        SELECT 
          a.student_rollno, 
          t.subject_id,
          ROUND(
            (
              SUM(CASE WHEN a.status = 'Present' THEN t.duration ELSE 0 END)
              * 100.0
            )
            / NULLIF(SUM(t.duration), 0),
            2
          ) AS percentage
        FROM attendance a
        JOIN timetable t 
          ON t.timetable_id = a.timetable_id
        WHERE a.submitted = true
        AND t.class_id = $1
        AND t.academic_year = $2
        AND t.lecture_type = 'LECTURE'
        AND EXTRACT(MONTH FROM a.attendance_date) = $3
        GROUP BY a.student_rollno, t.subject_id
      `;
      params = [class_id, academic_year, month];
    }

    const attendanceResult = await pool.query(attendanceQuery, params);

    // ======================
    // SUBJECTS (ONLY FOR NON-JAN)
    // ======================

    let subjects = [];

    if (!isJanuary) {
      const subjectsResult = await pool.query(
        `
        SELECT DISTINCT s.subject_id, s.subject_name
        FROM subjects s
        WHERE s.subject_id IN (
            SELECT DISTINCT t.subject_id
            FROM timetable t
            WHERE t.class_id = $1
            AND t.academic_year = $2
            AND t.lecture_type = 'LECTURE'
        )
        ORDER BY s.subject_name
        `,
        [class_id, academic_year]
      );

      subjects = subjectsResult.rows;

      if (!subjects.length) {
        return res.status(400).json({ message: "No lecture subjects found" });
      }
    }

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
      if (!matrix[row.student_rollno]) return;

      if (isJanuary) {
        matrix[row.student_rollno].avg = Number(row.percentage) || 0;
      } else {
        matrix[row.student_rollno].subjects[row.subject_id] =
          Number(row.percentage) || 0;
      }
    });

    if (!isJanuary) {
      Object.keys(matrix).forEach(roll => {
        const values = Object.values(matrix[roll].subjects);
        matrix[roll].avg =
          values.length
            ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
            : 0;
      });
    }

    // ======================
    // PDF EXPORT
    // ======================
if (format === "pdf") {

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 30
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${divisionName}-${month}.pdf`
  );

  doc.pipe(res);

  doc.font("Helvetica-Bold")
     .fontSize(16)
     .text("Attendance Report", { align: "center" });

  doc.moveDown(0.3);

  doc.font("Helvetica")
     .fontSize(12)
     .text(`Month: ${month} | Academic Year: ${academic_year}`, {
       align: "center"
     });

  doc.moveDown(2);

  const startX = 30;
  let y = doc.y;
  const rowHeight = 25;
  const isJanuary = Number(month) === 1;

  const srWidth = 45;
  const rollWidth = 70;
  const nameWidth = 220;
  const avgWidth = 60;

  const pageWidth = doc.page.width - 60;

  let subjectWidth = 0;

  if (!isJanuary) {
    subjectWidth =
      (pageWidth - (srWidth + rollWidth + nameWidth + avgWidth))
      / subjects.length;
  }

  // ================= HEADER =================

  const drawHeader = () => {

    let x = startX;

    doc.font("Helvetica-Bold").fontSize(10);

    if (isJanuary) {

      // Simple header
      doc.rect(x, y, srWidth, rowHeight).stroke();
      doc.text("SR NO", x, y + 8, { width: srWidth, align: "center" });
      x += srWidth;

      doc.rect(x, y, rollWidth, rowHeight).stroke();
      doc.text("ROLL NO", x, y + 8, { width: rollWidth, align: "center" });
      x += rollWidth;

      doc.rect(x, y, nameWidth, rowHeight).stroke();
      doc.text("NAME OF THE STUDENT", x, y + 8, {
        width: nameWidth,
        align: "center"
      });
      x += nameWidth;

      doc.rect(x, y, avgWidth, rowHeight).stroke();
      doc.text("AVG", x, y + 8, {
        width: avgWidth,
        align: "center"
      });

      y += rowHeight;

    } else {

      // Row 1 (merged header)
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
      doc.text("AVG", x, y + 15, {
        width: avgWidth,
        align: "center"
      });

      y += rowHeight;

      // Row 2 (subject names)
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
    }
  };

  drawHeader();

  doc.font("Helvetica").fontSize(9);

  let sr = 1;

  Object.keys(matrix).forEach(roll => {

    if (y + rowHeight > doc.page.height - 40) {
      doc.addPage();
      y = 40;
      drawHeader();
    }

    let x = startX;
    const student = matrix[roll];

    const rowData = isJanuary
      ? [sr++, roll, student.name, student.avg]
      : [
          sr++,
          roll,
          student.name,
          ...subjects.map(sub =>
            student.subjects[sub.subject_id] ?? 0
          ),
          student.avg
        ];

    rowData.forEach((cell, i) => {

      let width;

      if (i === 0) width = srWidth;
      else if (i === 1) width = rollWidth;
      else if (i === 2) width = nameWidth;
      else if (i === rowData.length - 1) width = avgWidth;
      else width = subjectWidth;

      doc.rect(x, y, width, rowHeight).stroke();

      if (!isJanuary && i > 2 && i < rowData.length - 1 && cell < 75) {
        doc.fillColor("red");
      }

      if (isJanuary && i === 3 && cell < 75) {
        doc.fillColor("red");
      }

      doc.text(cell, x, y + 8, {
        width,
        align: "center"
      });

      doc.fillColor("black");
      x += width;
    });

    y += rowHeight;
  });

  doc.end();
  return;
}



    // ======================
    // EXCEL EXPORT
    // ======================

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Attendance");

    const header = isJanuary
      ? ["Sr", "Roll", "Name", "Monthly %"]
      : [
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

      const row = isJanuary
        ? [sr++, roll, student.name, student.avg]
        : [
            sr++,
            roll,
            student.name,
            ...subjects.map(s => student.subjects[s.subject_id] ?? 0),
            student.avg
          ];

      sheet.addRow(row);
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${divisionName}-${month}.xlsx`
    );

    return res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error generating report" });
  }
};
