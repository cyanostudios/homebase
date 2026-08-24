/**
 * Plugin-target adapter registry for request routing.
 */
const garmentsAdapter = require('./garments');

const adapters = Object.freeze({
  [garmentsAdapter.PLUGIN_ID]: garmentsAdapter,
});

function getAdapter(pluginId) {
  if (!pluginId) return null;
  return adapters[String(pluginId)] || null;
}

function listPluginIds() {
  return Object.keys(adapters);
}

module.exports = {
  getAdapter,
  listPluginIds,
};
