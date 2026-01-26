import { transporter } from "../config/mail.js";
import pg from "../config/database.js";

export const getStudentEmail= async (req,res)=>{
   try {
    const {studentId}=req.body;
    const result=await pg.query(
        `SELECT email FROM students WHERE student_rollno=$1`,
        [studentId]
    )
    return res.status(200).json({
        success:true,
        data:result.rows[0]
    })
   } catch (error) {
    console.log(error);
    return res.status(500).json({
        success:false,
        message:"Failed to get student email"
    })
   }
    
}

export const sendEmail= async (req,res)=>{
    try {
        const teacherId= req.user.id;
        const { to, subject, message } = req.body;
         await transporter.sendMail({
      from: `"Upasthit" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: `
        <h2>From ${teacherId}</h2>
        <p>${message}</p>
      `,
    });

    res.status(200).json({ success: true, message: "Email sent successfully" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success:false,
            message:"Failed to send email"
        })
    }
}