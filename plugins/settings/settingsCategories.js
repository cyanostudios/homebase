// Allowlisted user_settings categories (core + plugin settings keys).

const ALLOWED_SETTINGS_CATEGORIES = new Set([
  'preferences',
  'profile',
  'team',
  'contacts',
  'tasks',
  'notes',
  'requests',
  'teams',
  'cups',
  'slots',
  'matches',
  'estimates',
  'invoices',
  'garments',
  'mail',
  'pulses',
  'ai-providers',
  'ingest',
  'schedule',
  'files',
  'instructions',
  'clubdesk',
]);

/** Known keys per category (documentation; partial updates merge via JSONB ||). */
const MATCHES_SETTINGS_KEYS = new Set([
  'viewMode',
  'columnCount',
  'listViewMode',
  'defaultHomeTeam',
  'apiKey',
  'apiBaseUrl',
]);

function isAllowedSettingsCategory(category) {
  return typeof category === 'string' && ALLOWED_SETTINGS_CATEGORIES.has(category.trim());
}

module.exports = {
  ALLOWED_SETTINGS_CATEGORIES,
  MATCHES_SETTINGS_KEYS,
  isAllowedSettingsCategory,
};
