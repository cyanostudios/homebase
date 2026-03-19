/**
 * Shared send logic using per-user pulse (SMS) settings.
 * Use this from other plugins to send SMS with the current user's Twilio (or mock) config.
 */
const model = require('./model');
const TwilioAdapter = require('./adapters/TwilioAdapter');
const MockAdapter = require('./adapters/MockAdapter');
const AppleMessagesAdapter = require('./adapters/AppleMessagesAdapter');
const { AppError } = require('../../server/core/errors/AppError');

async function getSmsAdapterForUser(req) {
  const userSettings = await model.getSettings(req, { needsPassword: true });
  // Default to mock when no settings exist (safe/dev-friendly).
  const provider = userSettings?.activeProvider || 'mock';
  if (provider === 'mock') {
    return { adapter: new MockAdapter(), provider: 'mock' };
  }
  if (provider === 'apple-messages') {
    if (process.platform !== 'darwin') {
      throw new AppError(
        'Apple Messages is only available on macOS. Switch provider to Twilio or Mock.',
        400,
        AppError.CODES.BAD_REQUEST,
      );
    }
    return { adapter: new AppleMessagesAdapter(), provider: 'apple-messages' };
  }
  if (
    userSettings?.twilioAccountSidRaw &&
    userSettings?.twilioAuthTokenRaw &&
    userSettings?.twilioFromNumber &&
    String(userSettings.twilioFromNumber).trim()
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
  // Do not silently fall back to mock when user has selected Twilio.
  // This avoids "fake success" from other plugins (contacts/slots) when Twilio isn't configured.
  throw new AppError(
    'Twilio settings are incomplete. Open Pulse settings and save Account SID, Auth Token and From number (or switch provider to Mock).',
    400,
    AppError.CODES.BAD_REQUEST,
  );
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
