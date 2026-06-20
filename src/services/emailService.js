const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

let transporter = null;

const createTransporter = () => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    logger.warn("⚠️  Gmail not configured — set GMAIL_USER and GMAIL_APP_PASSWORD in .env");
    return null;
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // SSL on port 465
    auth: { user, pass },
    connectionTimeout: 10000,  // 10s to connect
    greetingTimeout: 5000,     // 5s for server greeting
    socketTimeout: 20000,      // 20s for data transfer
  });
};

// Lazy-initialize so hot reloads pick up new env vars
const getTransporter = () => {
  if (!transporter) transporter = createTransporter();
  return transporter;
};

// Warn at startup if Gmail is not configured
if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD ||
    process.env.GMAIL_USER === "your-gmail@gmail.com") {
  logger.warn("⚠️  Gmail not configured — emails will fail. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env");
} else {
  logger.info(`✅ Gmail email service ready (${process.env.GMAIL_USER})`);
}

const FROM_NAME = process.env.EMAIL_FROM_NAME || "HND Gateway";
const getFrom = () => `${FROM_NAME} <${process.env.GMAIL_USER}>`;

const sendEmail = async (options) => {
  const t = getTransporter();
  if (!t) throw new Error("Email service not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.");

  const info = await t.sendMail({
    from: options.from || getFrom(),
    to: options.to,
    subject: options.subject,
    html: options.html || wrapPlainText(options.text || ""),
    text: options.text || undefined,
  });

  logger.info(`Email sent to ${options.to} | messageId=${info.messageId}`);
  return info;
};

// ── HTML template helpers ─────────────────────────────────────────────────────

function baseTemplate(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:32px 40px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:0.5px;">HND Gateway</h1>
        <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Your Academic Portal</p>
      </td></tr>
      <tr><td style="padding:40px;">${bodyHtml}</td></tr>
      <tr><td style="background:#f8f9fa;padding:20px 40px;text-align:center;border-top:1px solid #e9ecef;">
        <p style="color:#6c757d;font-size:12px;margin:0;">
          &copy; ${new Date().getFullYear()} HND Gateway. All rights reserved.<br/>
          If you did not request this email, please ignore it.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function wrapPlainText(text) {
  const escaped = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
  return baseTemplate("HND Gateway", `<p style="color:#333;line-height:1.7;font-size:15px;">${escaped}</p>`);
}

// ── Named email builders ──────────────────────────────────────────────────────

const buildOTPEmail = (firstName, otp) => ({
  subject: "Your Password Reset OTP – HND Gateway",
  html: baseTemplate("Password Reset OTP", `
    <h2 style="color:#1a73e8;margin-top:0;">Reset Your Password</h2>
    <p style="color:#333;font-size:15px;line-height:1.7;">Hi ${firstName || "there"},</p>
    <p style="color:#333;font-size:15px;line-height:1.7;">Use the OTP below to reset your password:</p>
    <div style="text-align:center;margin:32px 0;">
      <span style="display:inline-block;background:#1a73e8;color:#fff;font-size:36px;font-weight:bold;letter-spacing:10px;padding:16px 32px;border-radius:8px;">${otp}</span>
    </div>
    <p style="color:#666;font-size:13px;text-align:center;">This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
    <p style="color:#999;font-size:12px;margin-top:32px;">If you didn't request this, you can safely ignore this email.</p>
  `),
  text: `Your HND Gateway password reset OTP is: ${otp}\n\nExpires in 60 seconds. Do not share it.`,
});

const buildVerificationEmail = (firstName, verifyUrl) => ({
  subject: "Verify Your Email – HND Gateway",
  html: baseTemplate("Email Verification", `
    <h2 style="color:#1a73e8;margin-top:0;">Verify Your Email Address</h2>
    <p style="color:#333;font-size:15px;line-height:1.7;">Hi ${firstName || "there"},</p>
    <p style="color:#333;font-size:15px;line-height:1.7;">Welcome to HND Gateway! Click below to verify your email and activate your account.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${verifyUrl}" style="display:inline-block;background:#1a73e8;color:#fff;font-size:16px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;">Verify My Email</a>
    </div>
    <p style="color:#666;font-size:13px;text-align:center;">This link expires in <strong>24 hours</strong>.</p>
    <p style="color:#666;font-size:13px;">Or copy this link:<br/><a href="${verifyUrl}" style="color:#1a73e8;word-break:break-all;">${verifyUrl}</a></p>
  `),
  text: `Welcome to HND Gateway!\n\nVerify your email:\n${verifyUrl}\n\nExpires in 24 hours.`,
});

const buildWelcomeEmail = (firstName) => ({
  subject: "Welcome to HND Gateway!",
  html: baseTemplate("Welcome!", `
    <h2 style="color:#1a73e8;margin-top:0;">Welcome, ${firstName || "Student"}!</h2>
    <p style="color:#333;font-size:15px;line-height:1.7;">Your email is verified and your account is now active.</p>
    <ul style="color:#555;font-size:14px;line-height:2;">
      <li>📚 Browse past papers by department</li>
      <li>📝 Take practice tests and quizzes</li>
      <li>🤖 Get AI-powered study assistance</li>
      <li>📖 Access study materials</li>
    </ul>
    <div style="text-align:center;margin:32px 0;">
      <a href="${process.env.FRONTEND_URL || "#"}" style="display:inline-block;background:#1a73e8;color:#fff;font-size:16px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;">Get Started</a>
    </div>
  `),
  text: `Welcome to HND Gateway, ${firstName}!\n\nYour account is active. Log in to start studying!`,
});

const buildPaymentSuccessEmail = (firstName, planName, expiryDate) => ({
  subject: "Payment Confirmed – HND Gateway",
  html: baseTemplate("Payment Confirmed", `
    <h2 style="color:#28a745;margin-top:0;">Payment Successful! ✓</h2>
    <p style="color:#333;font-size:15px;line-height:1.7;">Hi ${firstName || "there"},</p>
    <p style="color:#333;font-size:15px;line-height:1.7;">Your subscription to <strong>${planName}</strong> is now active.</p>
    <div style="background:#f8f9fa;border-left:4px solid #28a745;padding:16px;border-radius:4px;margin:24px 0;">
      <p style="margin:0;color:#333;font-size:14px;"><strong>Plan:</strong> ${planName}</p>
      ${expiryDate ? `<p style="margin:8px 0 0;color:#333;font-size:14px;"><strong>Valid Until:</strong> ${new Date(expiryDate).toDateString()}</p>` : ""}
    </div>
    <p style="color:#333;font-size:15px;">Happy studying!</p>
  `),
  text: `Payment confirmed! Your ${planName} is now active${expiryDate ? ` until ${new Date(expiryDate).toDateString()}` : ""}.`,
});

const buildOTPLockoutEmail = (firstName) => ({
  subject: "Account Security Alert – HND Gateway",
  html: baseTemplate("Security Alert", `
    <h2 style="color:#dc3545;margin-top:0;">Too Many Failed Attempts</h2>
    <p style="color:#333;font-size:15px;line-height:1.7;">Hi ${firstName || "there"},</p>
    <p style="color:#333;font-size:15px;line-height:1.7;">3 failed OTP attempts detected. Password reset is locked for <strong>30 minutes</strong>.</p>
    <p style="color:#666;font-size:14px;">If this wasn't you, please contact support immediately.</p>
  `),
  text: "Too many failed OTP attempts. Locked for 30 minutes. Contact support if this wasn't you.",
});

module.exports = sendEmail;
module.exports.buildOTPEmail = buildOTPEmail;
module.exports.buildVerificationEmail = buildVerificationEmail;
module.exports.buildWelcomeEmail = buildWelcomeEmail;
module.exports.buildPaymentSuccessEmail = buildPaymentSuccessEmail;
module.exports.buildOTPLockoutEmail = buildOTPLockoutEmail;
