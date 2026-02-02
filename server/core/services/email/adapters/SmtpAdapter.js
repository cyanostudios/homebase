// server/core/services/email/adapters/SmtpAdapter.js
// SMTP adapter using nodemailer

const nodemailer = require('nodemailer');

class SmtpAdapter {
  constructor(config = {}) {
    const smtp = config.smtp || {};
    this.from = smtp.from || process.env.SMTP_FROM || 'noreply@homebase.se';

    this.transporter = nodemailer.createTransport({
      host: smtp.host || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(smtp.port || process.env.SMTP_PORT || '587', 10),
      secure: smtp.secure || process.env.SMTP_SECURE === 'true',
      auth:
        smtp.auth?.user && smtp.auth?.pass
          ? {
              user: smtp.auth.user,
              pass: smtp.auth.pass,
            }
          : process.env.SMTP_USER && process.env.SMTP_PASS
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : undefined,
    });
  }

  async send(options) {
    const to = Array.isArray(options.to) ? options.to : [options.to];
    const mailOptions = {
      from: options.from || this.from,
      to: to.join(', '),
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    };

    await this.transporter.sendMail(mailOptions);
  }
}

module.exports = SmtpAdapter;
