// server/core/config/platformTenantsAdmin.js
// Hardcoded allowlist for the platform "tenants" admin plugin. Edit in code / PR only.

const PLATFORM_TENANTS_PLUGIN = 'tenants';

/** Allowed in every environment (owner / actor email, case-insensitive). */
const PLATFORM_TENANTS_ADMIN_OWNER_EMAILS = ['cyanostudios@gmail.com'];

/** Extra local-only allowlist (never effective when NODE_ENV === 'production'). */
const PLATFORM_TENANTS_ADMIN_OWNER_EMAILS_LOCAL = ['admin@homebase.se'];

/** Plugins that must never be toggled via the tenants admin UI. */
const PLATFORM_TENANTS_NON_TOGGLEABLE_PLUGINS = ['settings', PLATFORM_TENANTS_PLUGIN];

/**
 * Public companion backends (`public-cups`, …) — visible in tenants UI but no on/off
 * (no platform admin UI for them).
 */
function isPublicAppPlugin(pluginName) {
  return String(pluginName || '')
    .trim()
    .toLowerCase()
    .startsWith('public-');
}

/**
 * @param {{ nodeEnv?: string }} [opts]
 * @returns {string[]} lowercased emails
 */
function getEffectivePlatformTenantsAdminEmails(opts = {}) {
  const nodeEnv = opts.nodeEnv ?? process.env.NODE_ENV;
  const emails = [...PLATFORM_TENANTS_ADMIN_OWNER_EMAILS];
  if (nodeEnv !== 'production') {
    emails.push(...PLATFORM_TENANTS_ADMIN_OWNER_EMAILS_LOCAL);
  }
  return emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
}

/**
 * @param {string|null|undefined} email
 * @param {{ nodeEnv?: string }} [opts]
 */
function isEmailOnPlatformTenantsAdminAllowlist(email, opts = {}) {
  if (!email) return false;
  const needle = String(email).trim().toLowerCase();
  return getEffectivePlatformTenantsAdminEmails(opts).includes(needle);
}

/**
 * True when this tenant is a platform-admin account: all plugins forced on, not editable.
 * @param {string|null|undefined} ownerEmail
 * @param {{ nodeEnv?: string }} [opts]
 */
function isPlatformAdminLockedTenant(ownerEmail, opts = {}) {
  return isEmailOnPlatformTenantsAdminAllowlist(ownerEmail, opts);
}

/**
 * True if the **session user's** email is on the effective allowlist.
 * Does not inherit from tenant owner — invited members must not gain platform Tenants admin.
 * (`db` retained for call-site compatibility; unused.)
 * @param {import('express').Request} req
 * @param {{ query: Function }|null|undefined} [_db]
 * @param {{ nodeEnv?: string }} [opts]
 */
async function isPlatformTenantsAdminSession(req, _db, opts = {}) {
  const userEmail = req?.session?.user?.email;
  return isEmailOnPlatformTenantsAdminAllowlist(userEmail, opts);
}

/**
 * Inject or strip `tenants` from a plugin list based on allowlist.
 * @param {string[]} plugins
 * @param {boolean} allowed
 * @returns {string[]}
 */
function applyTenantsPluginVisibility(plugins, allowed) {
  const list = Array.isArray(plugins) ? plugins.filter((p) => p !== PLATFORM_TENANTS_PLUGIN) : [];
  if (allowed) {
    list.push(PLATFORM_TENANTS_PLUGIN);
  }
  return list;
}

/**
 * Whether a plugin row may show an on/off switch for a given tenant.
 * @param {string} pluginName
 * @param {boolean} pluginsLocked - platform-admin tenant
 */
function isPluginToggleableInTenantsAdmin(pluginName, pluginsLocked) {
  if (pluginsLocked) return false;
  if (PLATFORM_TENANTS_NON_TOGGLEABLE_PLUGINS.includes(pluginName)) return false;
  if (isPublicAppPlugin(pluginName)) return false;
  return true;
}

module.exports = {
  PLATFORM_TENANTS_PLUGIN,
  PLATFORM_TENANTS_ADMIN_OWNER_EMAILS,
  PLATFORM_TENANTS_ADMIN_OWNER_EMAILS_LOCAL,
  PLATFORM_TENANTS_NON_TOGGLEABLE_PLUGINS,
  getEffectivePlatformTenantsAdminEmails,
  isEmailOnPlatformTenantsAdminAllowlist,
  isPlatformAdminLockedTenant,
  isPublicAppPlugin,
  isPlatformTenantsAdminSession,
  applyTenantsPluginVisibility,
  isPluginToggleableInTenantsAdmin,
};
