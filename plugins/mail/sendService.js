/**
 * Shared send logic using per-user mail settings (Resend or SMTP).
 * Use this from other plugins (e.g. inspection) instead of ServiceManager.get('email').
 */
const ServiceManager = require('../../server/core/ServiceManager');
const model = require('./model');
const SmtpAdapter = require('../../server/core/services/email/adapters/SmtpAdapter');
const ResendAdapter = require('../../server/core/services/email/adapters/ResendAdapter');

/**
 * Get the email service for the current user (Resend or SMTP based on saved settings).
 * @param {object} req - Express request (for session/user)
 * @returns {object} - Email adapter with .send() method
 */
async function getEmailServiceForUser(req) {
  const userSettings = await model.getSettings(req, { needsPassword: true });
  if (userSettings?.provider === 'resend' && userSettings?.resendApiKeyRaw) {
    return new ResendAdapter({
      resend: {
        apiKey: userSettings.resendApiKeyRaw,
        from: userSettings.resendFromAddress || userSettings.fromAddress || 'onboarding@resend.dev',
      },
    });
  }
  if (userSettings?.host) {
    return new SmtpAdapter({
      smtp: {
        host: userSettings.host,
        port: userSettings.port,
        secure: userSettings.secure,
        from: userSettings.fromAddress,
        auth: (userSettings.authUser && userSettings.authPass)
          ? { user: userSettings.authUser, pass: userSettings.authPass }
          : undefined,
      },
    });
  }
  return ServiceManager.get('email');
}

/**
 * Send email using the current user's saved mail settings (Resend or SMTP).
 * @param {object} req - Express request
 * @param {object} payload - { to, bcc, subject, html?, text?, attachments? }
 * @param {object} logOpts - { pluginSource?, referenceId? } for mail_log
 */
async function sendWithUserSettings(req, payload, logOpts = {}) {
  const toRecipients = Array.isArray(payload.to) ? payload.to : (payload.to ? [payload.to] : []);
  const bccRecipients = Array.isArray(payload.bcc) ? payload.bcc : (payload.bcc ? [payload.bcc] : []);

  const normalizedTo = toRecipients.map((r) => String(r).trim()).filter(Boolean);
  const normalizedBcc = bccRecipients.map((r) => String(r).trim()).filter(Boolean);

  if (normalizedTo.length === 0 && normalizedBcc.length === 0) {
    throw new Error('At least one valid recipient (to or bcc) is required');
  }

  const attachmentBuffers = (payload.attachments || []).map((a) => ({
    filename: a.filename,
    content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(String(a.content), 'base64'),
  }));

  const emailService = await getEmailServiceForUser(req);

  // If we only have BCC, default 'to' to the sender's address to satisfy API requirements
  let finalTo = normalizedTo;
  if (finalTo.length === 0 && normalizedBcc.length > 0) {
    const userSettings = await model.getSettings(req);
    const sender = userSettings?.fromAddress || userSettings?.resendFromAddress || 'noreply@homebase.se';
    finalTo = [sender];
  }

  await emailService.send({
    to: finalTo,
    bcc: normalizedBcc.length > 0 ? normalizedBcc : undefined,
    subject: String(payload.subject || '').trim(),
    html: payload.html ? String(payload.html) : undefined,
    text: payload.text ? String(payload.text) : undefined,
    attachments: attachmentBuffers.length > 0 ? attachmentBuffers : undefined,
  });

  const logEntry = await model.logSent(req, {
    to: normalizedTo,
    bcc: normalizedBcc,
    subject: String(payload.subject || '').trim(),
    pluginSource: logOpts.pluginSource || null,
    referenceId: logOpts.referenceId || null,
  });

  return logEntry;
}

module.exports = { getEmailServiceForUser, sendWithUserSettings };
