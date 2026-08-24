/**
 * Coerce settings.requests.requestTypes (legacy string[] or RequestTypeConfig[])
 * and strip secrets for public branding.
 */

const SUPPORTED_PLUGINS = new Set(['garments']);

function coerceRequestTypeConfig(entry) {
  if (typeof entry === 'string') {
    const key = entry.trim().slice(0, 100);
    return key ? { key } : null;
  }
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }
  const key = typeof entry.key === 'string' ? entry.key.trim().slice(0, 100) : '';
  if (!key) return null;

  const config = { key };
  const plugin =
    entry.plugin === null || entry.plugin === undefined || entry.plugin === ''
      ? null
      : String(entry.plugin).trim();

  if (plugin && SUPPORTED_PLUGINS.has(plugin)) {
    config.plugin = plugin;
    if (entry.targetListId != null && String(entry.targetListId).trim()) {
      config.targetListId = String(entry.targetListId).trim().slice(0, 50);
    }
    if (Array.isArray(entry.intakeSchema)) {
      config.intakeSchema = entry.intakeSchema
        .map((field) => {
          if (!field || typeof field !== 'object') return null;
          const fieldKey = typeof field.key === 'string' ? field.key.trim() : '';
          if (!fieldKey) return null;
          const out = { key: fieldKey };
          if (field.required === true) out.required = true;
          return out;
        })
        .filter(Boolean)
        .slice(0, 50);
    }
  }

  return config;
}

function coerceRequestTypes(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    const config = coerceRequestTypeConfig(entry);
    if (!config || seen.has(config.key)) continue;
    seen.add(config.key);
    out.push(config);
  }
  return out;
}

/** Public branding shape: never expose targetListId. */
function toPublicRequestType(config) {
  if (!config || !config.key) return null;
  const out = { key: config.key };
  if (config.plugin) out.plugin = config.plugin;
  if (Array.isArray(config.intakeSchema) && config.intakeSchema.length > 0) {
    out.intakeSchema = config.intakeSchema.map((f) => {
      const item = { key: f.key };
      if (f.required === true) item.required = true;
      return item;
    });
  }
  return out;
}

function findRequestTypeConfig(rawTypes, requestTypeKey) {
  const key = (requestTypeKey || '').toString().trim();
  if (!key) return null;
  return coerceRequestTypes(rawTypes).find((t) => t.key === key) || null;
}

module.exports = {
  SUPPORTED_PLUGINS,
  coerceRequestTypeConfig,
  coerceRequestTypes,
  toPublicRequestType,
  findRequestTypeConfig,
};
