import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// SendGrid transporter
const sendgridTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // smtp.sendgrid.net
  auth: {
    user: process.env.EMAIL_USER, // apikey
    pass: process.env.EMAIL_PASS, // SendGrid API key
  },
});

// Gmail transporter (fallback)
const gmailTransporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, text, html }) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    ...(html ? { html } : { text }),
  };

  try {
    // Try SendGrid first
    await sendgridTransporter.sendMail(mailOptions);
    console.log("✅ Email sent using SendGrid");
  } catch (error) {
    console.log("⚠️ SendGrid failed, switching to Gmail...");

    try {
      await gmailTransporter.sendMail(mailOptions);
      console.log("✅ Email sent using Gmail fallback");
    } catch (gmailError) {
      console.error("❌ Gmail fallback also failed:", gmailError);
    }
  }
};

export { sendEmail };














// import nodemailer from 'nodemailer';
// import dotenv from 'dotenv';

// dotenv.config();

// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
//   // Optional for development only:
//   // tls: { rejectUnauthorized: false },
// });

// const sendEmail = async ({ to, subject, text, html }) => {
//   const mailOptions = {
//     from: process.env.EMAIL_FROM,
//     to,
//     subject,
//     ...(html ? { html } : { text }),
//   };

//   try {
//     await transporter.sendMail(mailOptions);
//     console.log('✅ Email sent successfully');
//   } catch (error) {
//     console.error('❌ Error sending email:', error);
//   }
// };


// export { sendEmail };
