/**
 * Registry for SMS notification adapters (send { to, body }).
 * Verify/OTP providers are intentionally not registered in v1.
 */
const TwilioAdapter = require('./adapters/TwilioAdapter');
const MockAdapter = require('./adapters/MockAdapter');

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
    throw new Error(`No SMS adapter registered for provider: ${key}`);
  }
  return factory(config);
}

function ensureDefaultSmsAdaptersRegistered() {
  if (!factories.has('twilio')) {
    register('twilio', (config) => {
      return new TwilioAdapter({
        accountSid: config.secretPrimary || config.accountSid || '',
        authToken: config.secretSecondary || config.authToken || '',
        fromNumber: config.options?.fromNumber || config.fromNumber || '',
      });
    });
  }
  if (!factories.has('mock')) {
    register('mock', () => new MockAdapter());
  }
}

ensureDefaultSmsAdaptersRegistered();

module.exports = {
  register,
  has,
  create,
  ensureDefaultSmsAdaptersRegistered,
};
