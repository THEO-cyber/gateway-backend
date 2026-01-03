// Resend-based email service for HND Gateway
const { Resend } = require("resend");
const logger = require("../utils/logger");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
  try {
    const data = await resend.emails.send({
      from: options.from || `HND Gateway <noreply@hndgateway.online>`,
      to: options.to,
      subject: options.subject,
      html: options.html || undefined,
      text: options.text || undefined,
    });
    logger.info(
      `Email sent to ${options.to}. Resend response: ${JSON.stringify(data)}`
    );
    return data;
  } catch (error) {
    logger.error(`Email send error: ${error.message}`);
    throw error;
  }
};

module.exports = sendEmail;
