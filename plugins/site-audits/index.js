// plugins/site-audits/index.js
// V3: PluginSDK context — see plugin-loader.js (single-argument initializer).
const SiteAuditModel = require('./model');
const SiteAuditController = require('./controller');
const createSiteAuditRoutes = require('./routes');
const config = require('./plugin.config');

// NOTE on failStaleRuns: the ADR asks us to mark any `queued`/`running` run older than
// 30 minutes as `failed` on plugin init. Plugin init only receives the cross-tenant
// PluginSDK `context` (no per-request tenant pool/db) — there is no single "the" tenant
// pool to sweep here in this multi-tenant (one Postgres DB per user) architecture.
// Rather than guessing a tenant or iterating all tenants at boot, stale runs are swept
// lazily, scoped to the tenant making the call:
//   - services/runAudit.js `startRun()` sweeps before creating a new run.
//   - model.js `getRunsForSite()` sweeps before listing runs.
//   - model.js `getRunById()` sweeps before the poll response.
// Both use the request's own tenant pool (`Database.get(req).getPool()`).
function initializeSiteAuditsPlugin(context) {
  const model = new SiteAuditModel();
  const controller = new SiteAuditController(model);
  const router = createSiteAuditRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeSiteAuditsPlugin;
