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
  'ingest',
  'schedule',
]);

function isAllowedSettingsCategory(category) {
  return typeof category === 'string' && ALLOWED_SETTINGS_CATEGORIES.has(category.trim());
}

module.exports = {
  ALLOWED_SETTINGS_CATEGORIES,
  isAllowedSettingsCategory,
};
