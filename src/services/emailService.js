const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

const sendEmail = async (options) => {
  // Create transporter
  const transporter = nodemailer.createTransporter({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // Define email options
  const mailOptions = {
    from: `HND Gateway <${process.env.EMAIL_USER}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  // Send email
  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${options.to}`);
  } catch (error) {
    logger.error(`Email send error: ${error.message}`);
    throw error;
  }
};

module.exports = sendEmail;
