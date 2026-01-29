// src/config/mail.js
import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // Gmail App Password
  },

  // 🔥 critical for prod
  pool: true,                 // reuse SMTP connection
  maxConnections: 5,
  maxMessages: 100,

  // ⏱ prevent hanging
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 5000,
});
