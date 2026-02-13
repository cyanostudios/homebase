// server/core/services/email/adapters/ResendAdapter.js
// Resend.com adapter

const { Resend } = require('resend');

class ResendAdapter {
  constructor(config = {}) {
    const resend = config.resend || {};
    this.apiKey = resend.apiKey || process.env.RESEND_API_KEY;
    this.from =
      resend.from || process.env.RESEND_FROM || process.env.SMTP_FROM || 'noreply@homebase.se';

    if (!this.apiKey) {
      throw new Error('Resend API key is required. Set RESEND_API_KEY or configure in services.');
    }

    this.resend = new Resend(this.apiKey);
  }

  async send(options) {
    const to = Array.isArray(options.to) ? options.to : [options.to];

    const attachmentObjects = options.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    }));

    const { error } = await this.resend.emails.send({
      from: options.from || this.from,
      to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: attachmentObjects,
    });

    if (error) {
      throw new Error(`Resend send failed: ${error.message}`);
    }
  }
}

module.exports = ResendAdapter;
