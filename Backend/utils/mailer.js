const nodemailer = require("nodemailer");

const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

// Sends an email. With no SMTP settings (development) it prints the email to
// the terminal instead, so links such as "reset password" are still usable.
async function sendMail({ to, subject, text }) {
  if (!transport) {
    console.log(`MAIL (SMTP not configured, printed instead of sent)\n  to: ${to}\n  subject: ${subject}\n  ${text.replace(/\n/g, "\n  ")}`);
    return false;
  }
  try {
    await transport.sendMail({ from: process.env.MAIL_FROM || "MellowWeather <no-reply@mellowweather.local>", to, subject, text });
    return true;
  } catch (error) {
    console.error("MAIL ERROR:", error.message);
    return false;
  }
}

const clientUrl = () => (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

module.exports = { sendMail, clientUrl };
