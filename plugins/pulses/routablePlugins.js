/**
 * Plugins that may override the global Pulse SMS provider via routing.
 */
const ROUTABLE_PLUGINS = Object.freeze([
  Object.freeze({ key: 'pulses', label: 'Pulse' }),
  Object.freeze({ key: 'contacts', label: 'Contacts' }),
  Object.freeze({ key: 'slots', label: 'Slots' }),
]);

const ROUTABLE_PLUGIN_KEYS = new Set(ROUTABLE_PLUGINS.map((entry) => entry.key));

function isRoutablePluginKey(pluginKey) {
  return ROUTABLE_PLUGIN_KEYS.has(
    String(pluginKey ?? '')
      .trim()
      .toLowerCase(),
  );
}

function normalizeRoutablePluginKey(pluginKey) {
  const normalized = String(pluginKey ?? '')
    .trim()
    .toLowerCase();
  if (!ROUTABLE_PLUGIN_KEYS.has(normalized)) {
    const { AppError } = require('../../server/core/errors/AppError');
    throw new AppError('Unsupported routable plugin', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return normalized;
}

module.exports = {
  ROUTABLE_PLUGINS,
  ROUTABLE_PLUGIN_KEYS,
  isRoutablePluginKey,
  normalizeRoutablePluginKey,
};
