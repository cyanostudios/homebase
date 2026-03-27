// server/migrations/policy.js
// Single source of truth for migration scope.

const PUBLIC_ONLY_MIGRATIONS = new Set([
  '028-user-settings.sql',
  '037-fx-rates.sql',
  '054-user-mfa.sql',
  '064-drop-public-products.sql',
  '071-drop-public-channel-tables.sql',
  '081-tenant-memberships-and-plugin-access.sql',
  '084-drop-user-id-from-public-tenants.sql',
]);

function isPublicOnlyMigration(fileName) {
  return PUBLIC_ONLY_MIGRATIONS.has(String(fileName || ''));
}

function getPublicOnlyMigrations(files) {
  return (files || []).filter((f) => isPublicOnlyMigration(f));
}

function getTenantMigrations(files) {
  return (files || []).filter((f) => !isPublicOnlyMigration(f));
}

module.exports = {
  PUBLIC_ONLY_MIGRATIONS,
  isPublicOnlyMigration,
  getPublicOnlyMigrations,
  getTenantMigrations,
};
