/**
 * Shared send logic using per-user pulse (SMS) settings.
 * Use this from other plugins to send SMS with the current user's Twilio (or mock) config.
 */
const model = require('./model');
const TwilioAdapter = require('./adapters/TwilioAdapter');
const MockAdapter = require('./adapters/MockAdapter');

async function getSmsAdapterForUser(req) {
  const userSettings = await model.getSettings(req, { needsPassword: true });
  const provider = userSettings?.activeProvider || 'twilio';
  if (provider === 'mock') {
    return { adapter: new MockAdapter(), provider: 'mock' };
  }
  if (
    userSettings?.twilioAccountSidRaw &&
    userSettings?.twilioAuthTokenRaw &&
    userSettings?.twilioFromNumber
  ) {
    return {
      adapter: new TwilioAdapter({
        accountSid: userSettings.twilioAccountSidRaw,
        authToken: userSettings.twilioAuthTokenRaw,
        fromNumber: userSettings.twilioFromNumber.trim(),
      }),
      provider: 'twilio',
    };
  }
  return { adapter: new MockAdapter(), provider: 'mock' };
}

async function sendSmsWithUserSettings(req, payload, logOpts = {}) {
  const to = typeof payload.to === 'string' ? payload.to.trim() : '';
  const body = payload.body != null ? String(payload.body) : '';
  if (!to) {
    throw new Error('SMS recipient (to) is required');
  }

  const { adapter, provider } = await getSmsAdapterForUser(req);
  const result = await adapter.send({ to, body });

  const logEntry = await model.logSent(req, {
    recipient: to,
    body: body || null,
    provider,
    status: result.status || 'sent',
    pluginSource: logOpts.pluginSource || null,
    referenceId: logOpts.referenceId || null,
  });

  return logEntry;
}

module.exports = { getSmsAdapterForUser, sendSmsWithUserSettings };
