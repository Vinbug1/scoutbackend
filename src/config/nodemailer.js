import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Twilio Email API — newer product, separate from classic SendGrid.
// Auth: Basic Auth with TWILIO_API_KEY / TWILIO_API_SECRET.
// Docs: https://www.twilio.com/docs/email/api/getting-started
const TWILIO_EMAIL_ENDPOINT = "https://comms.twilio.com/v1/Emails";

// Gmail transporter (fallback) — still SMTP, so it only works if
// outbound SMTP ports aren't blocked on this host.
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

const sendViaTwilioEmail = async ({ to, subject, text, html }) => {
  const body = {
    from: {
      address: process.env.EMAIL_FROM,
      name: "The Scouter Pro",
    },
    to: [{ address: to }],
    content: {
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    },
  };

  const authHeader = Buffer.from(
    `${process.env.TWILIO_API_KEY}:${process.env.TWILIO_API_SECRET}`
  ).toString("base64");

  const response = await fetch(TWILIO_EMAIL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${authHeader}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(
      `Twilio Email API responded with ${response.status}: ${errorBody}`
    );
    error.status = response.status;
    error.body = errorBody;
    throw error;
  }

  return response.json();
};

const sendEmail = async ({ to, subject, text, html }) => {
  try {
    // Try Twilio Email API's HTTP endpoint first
    await sendViaTwilioEmail({ to, subject, text, html });
    console.log("✅ Email sent using Twilio Email API");
    return;
  } catch (error) {
    console.error(
      "⚠️ Twilio Email API failed, switching to Gmail...",
      error.body || error.message
    );

    try {
      await gmailTransporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        ...(html ? { html } : { text }),
      });
      console.log("✅ Email sent using Gmail fallback");
    } catch (gmailError) {
      console.error("❌ Gmail fallback also failed:", gmailError);
      throw gmailError;
    }
  }
};

export { sendEmail };
















// import sgMail from "@sendgrid/mail";
// import nodemailer from "nodemailer";
// import dotenv from "dotenv";

// dotenv.config();

// // SendGrid over HTTPS (port 443) — avoids the outbound SMTP port
// // blocking common on cloud/VPS hosts (Hetzner included).
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// // Gmail transporter (fallback) — still SMTP, so it only works if
// // outbound SMTP ports aren't blocked on this host.
// const gmailTransporter = nodemailer.createTransport({
//   service: "gmail",
//   host: "smtp.gmail.com",
//   port: 465,
//   secure: true,
//   auth: {
//     user: process.env.GMAIL_USER,
//     pass: process.env.GMAIL_PASS,
//   },
// });

// const sendEmail = async ({ to, subject, text, html }) => {
//   const mailOptions = {
//     from: process.env.EMAIL_FROM,
//     to,
//     subject,
//     ...(html ? { html } : { text }),
//   };

//   try {
//     // Try SendGrid's HTTP API first
//     await sgMail.send(mailOptions);
//     console.log("✅ Email sent using SendGrid");
//     return;
//   } catch (error) {
//     console.error(
//       "⚠️ SendGrid failed, switching to Gmail...",
//       error.response?.body || error.message
//     );

//     try {
//       await gmailTransporter.sendMail(mailOptions);
//       console.log("✅ Email sent using Gmail fallback");
//     } catch (gmailError) {
//       console.error("❌ Gmail fallback also failed:", gmailError);
//       throw gmailError;
//     }
//   }
// };

// export { sendEmail };













// import sgMail from "@sendgrid/mail";
// import nodemailer from "nodemailer";
// import dotenv from "dotenv";

// dotenv.config();

// // SendGrid over HTTPS (port 443) — avoids the outbound SMTP port
// // blocking common on cloud/VPS hosts (Hetzner included).
// sgMail.setApiKey(process.env.EMAIL_PASS); // SendGrid API key

// // Gmail transporter (fallback) — still SMTP, so it only works if
// // outbound SMTP ports aren't blocked on this host.
// const gmailTransporter = nodemailer.createTransport({
//   service: "gmail",
//   host: "smtp.gmail.com",
//   port: 465,
//   secure: true,
//   auth: {
//     user: process.env.GMAIL_USER,
//     pass: process.env.GMAIL_PASS,
//   },
// });

// const sendEmail = async ({ to, subject, text, html }) => {
//   const mailOptions = {
//     from: process.env.EMAIL_FROM,
//     to,
//     subject,
//     ...(html ? { html } : { text }),
//   };

//   try {
//     // Try SendGrid's HTTP API first
//     await sgMail.send(mailOptions);
//     console.log("✅ Email sent using SendGrid");
//     return;
//   } catch (error) {
//     console.error(
//       "⚠️ SendGrid failed, switching to Gmail...",
//       error.response?.body || error.message
//     );

//     try {
//       await gmailTransporter.sendMail(mailOptions);
//       console.log("✅ Email sent using Gmail fallback");
//     } catch (gmailError) {
//       console.error("❌ Gmail fallback also failed:", gmailError);
//     }
//   }
// };

// export { sendEmail };









// // import nodemailer from "nodemailer";
// // import dotenv from "dotenv";

// // dotenv.config();

// // // SendGrid transporter
// // const sendgridTransporter = nodemailer.createTransport({
// //   host: process.env.EMAIL_HOST, // smtp.sendgrid.net
// //   auth: {
// //     user: process.env.EMAIL_USER, // apikey
// //     pass: process.env.EMAIL_PASS, // SendGrid API key
// //   },
// // });

// // // Gmail transporter (fallback)
// // const gmailTransporter = nodemailer.createTransport({
// //   service: "gmail",
// //   host: "smtp.gmail.com",
// //   port: 465,
// //   secure: true,
// //   auth: {
// //     user: process.env.GMAIL_USER,
// //     pass: process.env.GMAIL_PASS,
// //   },
// // });

// // const sendEmail = async ({ to, subject, text, html }) => {
// //   const mailOptions = {
// //     from: process.env.EMAIL_FROM,
// //     to,
// //     subject,
// //     ...(html ? { html } : { text }),
// //   };

// //   try {
// //     // Try SendGrid first
// //     await sendgridTransporter.sendMail(mailOptions);
// //     console.log("✅ Email sent using SendGrid");
// //   } catch (error) {
// //     console.log("⚠️ SendGrid failed, switching to Gmail...");

// //     try {
// //       await gmailTransporter.sendMail(mailOptions);
// //       console.log("✅ Email sent using Gmail fallback");
// //     } catch (gmailError) {
// //       console.error("❌ Gmail fallback also failed:", gmailError);
// //     }
// //   }
// // };

// // export { sendEmail };














// // // import nodemailer from 'nodemailer';
// // // import dotenv from 'dotenv';

// // // dotenv.config();

// // // const transporter = nodemailer.createTransport({
// // //   host: process.env.EMAIL_HOST,
// // //   auth: {
// // //     user: process.env.EMAIL_USER,
// // //     pass: process.env.EMAIL_PASS,
// // //   },
// // //   // Optional for development only:
// // //   // tls: { rejectUnauthorized: false },
// // // });

// // // const sendEmail = async ({ to, subject, text, html }) => {
// // //   const mailOptions = {
// // //     from: process.env.EMAIL_FROM,
// // //     to,
// // //     subject,
// // //     ...(html ? { html } : { text }),
// // //   };

// // //   try {
// // //     await transporter.sendMail(mailOptions);
// // //     console.log('✅ Email sent successfully');
// // //   } catch (error) {
// // //     console.error('❌ Error sending email:', error);
// // //   }
// // // };


// // // export { sendEmail };
