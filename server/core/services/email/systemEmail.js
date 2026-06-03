// System transactional email (password reset, etc.) — uses env, not per-user Mail plugin settings.

const ResendAdapter = require('./adapters/ResendAdapter');
const SmtpAdapter = require('./adapters/SmtpAdapter');

/**
 * @returns {import('./EmailService')|null}
 */
function getSystemEmailService() {
  if (process.env.RESEND_API_KEY) {
    return new ResendAdapter({
      resend: {
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.RESEND_FROM || process.env.SMTP_FROM,
      },
    });
  }
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return new SmtpAdapter();
  }
  return null;
}

function isSystemEmailConfigured() {
  return Boolean(getSystemEmailService());
}

module.exports = { getSystemEmailService, isSystemEmailConfigured };
