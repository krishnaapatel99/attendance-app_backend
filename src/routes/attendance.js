import express from 'express';
import ExcelJS from 'exceljs';
import pool from '../config/database.js';

const router = express.Router();

router.get('/download-attendance', async (req, res) => {
  try {
    const { subject = 'CEPCC402', month = 2 } = req.query;

    // ✅ FIX 1: FORMAT DATE IN SQL (VERY IMPORTANT)
    const query = `
      SELECT 
        s.name,
        s.student_rollno,
        TO_CHAR(a.attendance_date, 'YYYY-MM-DD') AS attendance_date,
        a.status
      FROM attendance a
      JOIN students s ON s.student_rollno = a.student_rollno
      JOIN timetable t ON t.timetable_id = a.timetable_id
      WHERE t.subject_id = $1
      AND EXTRACT(MONTH FROM a.attendance_date) = $2
      ORDER BY s.student_rollno, a.attendance_date;
    `;

    const { rows } = await pool.query(query, [subject, month]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No data found' });
    }

    // 🔹 Pivot Logic
    const result = {};
    const dateSet = new Set();

    rows.forEach(r => {
      const roll = r.student_rollno;

      // ✅ FIX 2: DO NOT USE new Date()
      const date = r.attendance_date;

      dateSet.add(date);

      if (!result[roll]) {
        result[roll] = {
          name: r.name,
          roll: roll
        };
      }

      result[roll][date] = r.status;
    });

    const data = Object.values(result);

    // ✅ FIX 3: Proper date sorting
    const dates = Array.from(dateSet).sort((a, b) => new Date(a) - new Date(b));

    // 🔹 Create Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Attendance');

    sheet.columns = [
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Roll No', key: 'roll', width: 15 },
      ...dates.map(d => ({ header: d, key: d, width: 15 }))
    ];

    data.forEach(d => sheet.addRow(d));

    // 🔹 Style Header
    sheet.getRow(1).font = { bold: true };

    // 🔴 Highlight Absent
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      row.eachCell(cell => {
        if (cell.value === 'Absent') {
          cell.font = { color: { argb: 'FFFF0000' } };
        }
      });
    });

    // 🔹 Send File
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${subject}_month_${month}_attendance.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating Excel' });
  }
});

export default router;