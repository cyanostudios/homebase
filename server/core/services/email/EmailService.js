// server/core/services/email/EmailService.js
// Base interface for email adapters

/**
 * @typedef {Object} SendOptions
 * @property {string|string[]} to - Recipient email(s)
 * @property {string} subject - Email subject
 * @property {string} [html] - HTML body
 * @property {string} [text] - Plain text body (fallback)
 * @property {Array<{filename: string, content: Buffer}>} [attachments] - File attachments
 * @property {string} [from] - Override default from address
 */

/**
 * Base EmailService - adapters must implement send()
 */
class EmailService {
  /**
   * Send an email
   * @param {SendOptions} options
   * @returns {Promise<void>}
   */
  async send(options) {
    throw new Error('EmailService.send() must be implemented by adapter');
  }
}

module.exports = EmailService;
