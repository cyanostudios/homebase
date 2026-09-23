/**
 * Pulse SMS routing candidates: enabled tenant plugins (not a hardcoded allowlist).
 * Per-plugin send still requires sms_enabled on pulse_provider_routing.
 */

const EXCLUDED_PLUGIN_KEYS = new Set(['settings', 'booking', 'places']);

function normalizePluginKey(pluginKey) {
  return String(pluginKey ?? '')
    .trim()
    .toLowerCase();
}

function isExcludedFromPulseRouting(pluginKey) {
  const key = normalizePluginKey(pluginKey);
  if (!key) {
    return true;
  }
  if (key.startsWith('public-')) {
    return true;
  }
  return EXCLUDED_PLUGIN_KEYS.has(key);
}

function humanizePluginKey(pluginKey) {
  const key = normalizePluginKey(pluginKey);
  if (!key) {
    return '';
  }
  return key
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * @param {import('express').Request} req
 * @returns {{ key: string, label: string }[]}
 */
function listCandidatePluginsFromReq(req) {
  const raw = req?.session?.user?.plugins;
  const plugins = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const result = [];
  for (const entry of plugins) {
    const key = normalizePluginKey(entry);
    if (!key || seen.has(key) || isExcludedFromPulseRouting(key)) {
      continue;
    }
    seen.add(key);
    result.push({ key, label: humanizePluginKey(key) });
  }
  result.sort((a, b) => a.label.localeCompare(b.label));
  return result;
}

/**
 * @param {string} pluginKey
 * @param {import('express').Request} [req]
 */
function isRoutablePluginKey(pluginKey, req) {
  const key = normalizePluginKey(pluginKey);
  if (!key || isExcludedFromPulseRouting(key)) {
    return false;
  }
  const raw = req?.session?.user?.plugins;
  if (!Array.isArray(raw)) {
    // No session plugin list (internal callers / tests) — allow any non-excluded key.
    return true;
  }
  return raw.map(normalizePluginKey).includes(key);
}

/**
 * @param {string} pluginKey
 * @param {import('express').Request} [req]
 */
function normalizeRoutablePluginKey(pluginKey, req) {
  const normalized = normalizePluginKey(pluginKey);
  if (!normalized || isExcludedFromPulseRouting(normalized)) {
    const { AppError } = require('../../server/core/errors/AppError');
    throw new AppError('Unsupported routable plugin', 400, AppError.CODES.VALIDATION_ERROR);
  }
  const raw = req?.session?.user?.plugins;
  if (Array.isArray(raw) && !raw.map(normalizePluginKey).includes(normalized)) {
    const { AppError } = require('../../server/core/errors/AppError');
    throw new AppError(
      'Plugin is not enabled for this account',
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
  return normalized;
}

module.exports = {
  EXCLUDED_PLUGIN_KEYS,
  humanizePluginKey,
  listCandidatePluginsFromReq,
  isExcludedFromPulseRouting,
  isRoutablePluginKey,
  normalizeRoutablePluginKey,
  normalizePluginKey,
};
