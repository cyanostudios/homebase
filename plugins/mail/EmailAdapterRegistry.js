/**
 * Registry for email send adapters ({ to, subject, html?, text?, attachments? }).
 */
const SmtpAdapter = require('../../server/core/services/email/adapters/SmtpAdapter');
const ResendAdapter = require('../../server/core/services/email/adapters/ResendAdapter');

const factories = new Map();

function register(providerKey, factory) {
  const key = String(providerKey ?? '')
    .trim()
    .toLowerCase();
  if (!key || typeof factory !== 'function') {
    return;
  }
  factories.set(key, factory);
}

function has(providerKey) {
  return factories.has(
    String(providerKey ?? '')
      .trim()
      .toLowerCase(),
  );
}

function create(providerKey, config = {}) {
  const key = String(providerKey ?? '')
    .trim()
    .toLowerCase();
  const factory = factories.get(key);
  if (!factory) {
    throw new Error(`No email adapter registered for provider: ${key}`);
  }
  return factory(config);
}

function ensureDefaultEmailAdaptersRegistered() {
  if (!factories.has('smtp')) {
    register('smtp', (config) => {
      const options = config.options || {};
      const host = options.host || '';
      const port = parseInt(String(options.port || '587'), 10) || 587;
      const secure = String(options.secure || '').toLowerCase() === 'true';
      const authUser = options.authUser || '';
      const authPass = config.secretSecondary || '';
      const from = options.fromAddress || 'noreply@homebase.se';
      return new SmtpAdapter({
        smtp: {
          host,
          port,
          secure,
          from,
          auth: authUser && authPass ? { user: authUser, pass: authPass } : undefined,
        },
      });
    });
  }
  if (!factories.has('resend')) {
    register('resend', (config) => {
      return new ResendAdapter({
        resend: {
          apiKey: config.secretPrimary || '',
          from: config.options?.fromAddress || 'onboarding@resend.dev',
        },
      });
    });
  }
}

ensureDefaultEmailAdaptersRegistered();

module.exports = {
  register,
  has,
  create,
  ensureDefaultEmailAdaptersRegistered,
};
