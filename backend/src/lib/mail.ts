import nodemailer from "nodemailer";

// The transporter is our connection to the mail server. In dev that's Mailhog;
// in production you'd point these env vars at a real provider — no code change.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "mailhog",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false, // Mailhog uses plain SMTP; a real provider on port 465 would set true
});
// The reusable sender. Knows only WHO, the SUBJECT, and the BODY —
// nothing about GDPR or 2FA. Any feature can call this.
export async function sendMail(to: string, subject: string, body: string): Promise<void> {
  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? "Check-in <no-reply@checkin.local>",
    to,
    subject,
    text: body,
  });
}