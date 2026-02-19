/**
 * Twilio SMS adapter – sends SMS via Twilio REST API
 * Twilio is required lazily so the plugin loads even if the package is not installed yet.
 */
class TwilioAdapter {
  constructor(config = {}) {
    this.accountSid = config.accountSid || '';
    this.authToken = config.authToken || '';
    this.fromNumber = config.fromNumber || '';
    if (!this.accountSid || !this.authToken) {
      throw new Error('Twilio accountSid and authToken are required');
    }
    let twilio;
    try {
      twilio = require('twilio');
    } catch (e) {
      throw new Error(
        'Twilio package is not installed. Run: npm install twilio',
      );
    }
    this.client = twilio(this.accountSid, this.authToken);
  }

  /**
   * Send SMS
   * @param {object} options - { to: string, body: string }
   * @returns {Promise<{ sid: string, status: string }>}
   */
  async send(options) {
    const to = typeof options.to === 'string' ? options.to.trim() : '';
    const body = options.body != null ? String(options.body) : '';
    if (!to) {
      throw new Error('SMS recipient (to) is required');
    }
    const message = await this.client.messages.create({
      to,
      from: this.fromNumber,
      body: body || ' ',
    });
    return { sid: message.sid, status: message.status || 'sent' };
  }
}

module.exports = TwilioAdapter;
