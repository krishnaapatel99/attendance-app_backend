import * as brevo from "@getbrevo/brevo";

const apiInstance = new brevo.TransactionalEmailsApi();

// attach API key
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

export const sendOtpEmail = async ({ to, otp, purpose }) => {
  const subject =
    purpose === "FORGOT_PASSWORD"
      ? "Reset your password – OTP"
      : "Verify your email – OTP";

  const htmlContent = `
    <div style="font-family: Arial, sans-serif">
      <h2>${subject}</h2>
      <p>Your OTP is:</p>
      <h1 style="letter-spacing: 6px">${otp}</h1>
      <p>This OTP is valid for <b>5 minutes</b>.</p>
      <p>If you did not request this, please ignore this email.</p>
    </div>
  `;

  await apiInstance.sendTransacEmail({
    sender: {
      email: process.env.MAIL_FROM || "no-reply@upasthit.com",
      name: "Upasthit",
    },
    to: [{ email: to }],
    subject,
    htmlContent,
  });
};
export const sendGeneralEmail = async ({ to, subject, html }) => {
  await apiInstance.sendTransacEmail({
    sender: {
      email: process.env.MAIL_FROM || "no-reply@upasthit.com",
      name: "Upasthit",
    },
    to: Array.isArray(to)
      ? to.map(email => ({ email }))
      : [{ email: to }],
    subject,
    htmlContent: html,
  });
};
