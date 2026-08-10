/**
 * Shared send logic using Pulse provider routing + SMS adapters.
 * Use this from other plugins to send SMS with the current user's routed provider.
 */
const model = require('./model');
const providerModel = require('./providerModel');
const { PulseProviderRouter } = require('./PulseProviderRouter');
const SmsAdapterRegistry = require('./SmsAdapterRegistry');
const { AppError } = require('../../server/core/errors/AppError');
const { isSmsNotificationCapable } = require('./providerCatalog');

const router = new PulseProviderRouter({ settingsModel: providerModel });

/**
 * Resolve SMS adapter for the current user and optional plugin source.
 * @param {object} req
 * @param {{ pluginKey?: string }} [opts]
 */
async function getSmsAdapterForUser(req, opts = {}) {
  const pluginKey =
    String(opts.pluginKey || 'pulses')
      .trim()
      .toLowerCase() || 'pulses';

  const resolved = await router.resolve(req, { pluginKey });
  if (!resolved?.providerKey) {
    throw new AppError(
      'No SMS provider is configured. Open Pulse → Providers, add Twilio or Mock, then set routing.',
      400,
      AppError.CODES.BAD_REQUEST,
    );
  }

  if (!isSmsNotificationCapable(resolved.providerKey)) {
    throw new AppError(
      'Routed provider cannot send SMS notifications. Choose Twilio or Mock in Pulse routing.',
      400,
      AppError.CODES.BAD_REQUEST,
    );
  }

  if (!SmsAdapterRegistry.has(resolved.providerKey)) {
    throw new AppError(
      `SMS adapter is not available for provider "${resolved.providerKey}".`,
      400,
      AppError.CODES.BAD_REQUEST,
    );
  }

  if (resolved.providerKey !== 'mock') {
    const fromNumber = String(resolved.options?.fromNumber || '').trim();
    if (!resolved.secretPrimary || !resolved.secretSecondary || !fromNumber) {
      throw new AppError(
        'SMS provider settings are incomplete. Open Pulse providers and save credentials.',
        400,
        AppError.CODES.BAD_REQUEST,
      );
    }
  }

  const adapter = SmsAdapterRegistry.create(resolved.providerKey, {
    secretPrimary: resolved.secretPrimary,
    secretSecondary: resolved.secretSecondary,
    options: resolved.options || {},
  });

  return { adapter, provider: resolved.providerKey, source: resolved.source };
}

async function sendSmsWithUserSettings(req, payload, logOpts = {}) {
  const to = typeof payload.to === 'string' ? payload.to.trim() : '';
  const body = payload.body != null ? String(payload.body) : '';
  if (!to) {
    throw new Error('SMS recipient (to) is required');
  }

  const pluginKey = logOpts.pluginSource || 'pulses';
  const { adapter, provider } = await getSmsAdapterForUser(req, { pluginKey });
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

module.exports = { getSmsAdapterForUser, sendSmsWithUserSettings, router };
