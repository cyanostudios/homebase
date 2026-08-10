/**
 * Shared send logic using Mail provider routing + email adapters.
 */
const model = require('./model');
const providerModel = require('./providerModel');
const { MailProviderRouter } = require('./MailProviderRouter');
const EmailAdapterRegistry = require('./EmailAdapterRegistry');
const { AppError } = require('../../server/core/errors/AppError');
const { isEmailCapable } = require('./providerCatalog');

const router = new MailProviderRouter({ settingsModel: providerModel });

async function getEmailServiceForUser(req, opts = {}) {
  const pluginKey =
    String(opts.pluginKey || 'mail')
      .trim()
      .toLowerCase() || 'mail';

  const resolved = await router.resolve(req, { pluginKey });
  if (!resolved?.providerKey) {
    throw new AppError(
      'No email provider is configured. Open Mail → Providers, add SMTP or Resend, then set routing.',
      400,
      AppError.CODES.BAD_REQUEST,
    );
  }

  if (!isEmailCapable(resolved.providerKey)) {
    throw new AppError(
      'Routed provider cannot send email. Choose SMTP or Resend in Mail routing.',
      400,
      AppError.CODES.BAD_REQUEST,
    );
  }

  if (!EmailAdapterRegistry.has(resolved.providerKey)) {
    throw new AppError(
      `Email adapter is not available for provider "${resolved.providerKey}".`,
      400,
      AppError.CODES.BAD_REQUEST,
    );
  }

  if (resolved.providerKey === 'resend') {
    if (!resolved.secretPrimary || !String(resolved.options?.fromAddress || '').trim()) {
      throw new AppError(
        'Resend settings are incomplete. Open Mail providers and save API key and From address.',
        400,
        AppError.CODES.BAD_REQUEST,
      );
    }
  } else if (resolved.providerKey === 'smtp') {
    if (
      !String(resolved.options?.host || '').trim() ||
      !String(resolved.options?.fromAddress || '').trim()
    ) {
      throw new AppError(
        'SMTP settings are incomplete. Open Mail providers and save host and From address.',
        400,
        AppError.CODES.BAD_REQUEST,
      );
    }
  }

  return EmailAdapterRegistry.create(resolved.providerKey, {
    secretPrimary: resolved.secretPrimary,
    secretSecondary: resolved.secretSecondary,
    options: resolved.options || {},
  });
}

async function sendWithUserSettings(req, payload, logOpts = {}) {
  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
  const normalizedRecipients = recipients.map((r) => String(r).trim()).filter(Boolean);
  if (normalizedRecipients.length === 0) {
    throw new Error('At least one valid recipient is required');
  }

  const attachmentBuffers = (payload.attachments || []).map((a) => ({
    filename: a.filename,
    content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(String(a.content), 'base64'),
  }));

  const pluginKey = logOpts.pluginSource || 'mail';
  const emailService = await getEmailServiceForUser(req, { pluginKey });
  await emailService.send({
    to: normalizedRecipients,
    subject: String(payload.subject || '').trim(),
    html: payload.html ? String(payload.html) : undefined,
    text: payload.text ? String(payload.text) : undefined,
    attachments: attachmentBuffers.length > 0 ? attachmentBuffers : undefined,
  });

  const logEntry = await model.logSent(req, {
    to: normalizedRecipients,
    subject: String(payload.subject || '').trim(),
    pluginSource: logOpts.pluginSource || null,
    referenceId: logOpts.referenceId || null,
  });

  return logEntry;
}

module.exports = { getEmailServiceForUser, sendWithUserSettings, router };
