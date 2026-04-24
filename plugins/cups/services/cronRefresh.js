// plugins/cups/services/cronRefresh.js
// Cups auto-refresh cron service.
//
// Reads user_settings WHERE category = 'cups' AND autoRefresh = true,
// resolves each user's tenant connection, then calls importFromIngest
// (which already includes mark-and-sweep) for every allowedIngestSourceId.
//
// Intended to be called from POST /api/cron/cups/refresh (server/core/routes/cron.js).

const { Logger } = require('@homebase/core');
const ServiceManager = require('../../../server/core/ServiceManager');
const TenantContextService = require('../../../server/core/services/tenant/TenantContextService');
const CupsModel = require('../model');
const { importFromIngest } = require('./importFromIngest');

/**
 * Run auto-refresh for all cups users that opted in, or a single user if userId is provided.
 *
 * @param {{ userId?: number }} [options]
 * @returns {Promise<{
 *   usersProcessed: number,
 *   usersSkipped: number,
 *   results: Array<{ userId: number, sourceId: string, [key: string]: any }>,
 *   totals: { parsed: number, created: number, updated: number, skipped: number, softDeleted: number, hardDeleted: number, errors: number }
 * }>}
 */
async function runCupsAutoRefresh({ userId } = {}) {
  Logger.info('cups cron: starting auto-refresh', { userId: userId ?? 'all opt-in' });

  const connectionPool = ServiceManager.get('connectionPool');
  const mainPool = ServiceManager.getMainPool();

  // Fetch all opted-in rows (or a specific user for manual/test runs).
  let usersQuery;
  if (userId !== undefined && userId !== null) {
    usersQuery = mainPool.query(
      `SELECT user_id, settings
         FROM user_settings
        WHERE category = 'cups'
          AND COALESCE((settings->>'autoRefresh')::boolean, false) = true
          AND user_id = $1`,
      [Number(userId)],
    );
  } else {
    usersQuery = mainPool.query(
      `SELECT user_id, settings
         FROM user_settings
        WHERE category = 'cups'
          AND COALESCE((settings->>'autoRefresh')::boolean, false) = true`,
    );
  }
  const { rows: users } = await usersQuery;

  Logger.info('cups cron: found opt-in users', { count: users.length });

  const tenantContextService = new TenantContextService();
  const results = [];
  let usersSkipped = 0;

  for (const row of users) {
    const uid = row.user_id;
    let ctx;
    try {
      ctx = await tenantContextService.getTenantContextByUserId(uid);
    } catch (e) {
      Logger.error('cups cron: failed to resolve tenant context', e, { userId: uid });
      usersSkipped++;
      continue;
    }

    if (!ctx?.tenantConnectionString) {
      Logger.warn('cups cron: no tenant connection string, skipping user', { userId: uid });
      usersSkipped++;
      continue;
    }

    const tenantPool = connectionPool.getTenantPool(ctx.tenantConnectionString);

    // Construct a minimal synthetic request that satisfies Database.get() and IngestModel.
    const fakeReq = {
      tenantPool,
      session: {
        user: { id: uid },
        currentTenantUserId: uid,
      },
    };

    const allowed = Array.isArray(row.settings?.allowedIngestSourceIds)
      ? row.settings.allowedIngestSourceIds.map(String)
      : [];

    if (allowed.length === 0) {
      Logger.info('cups cron: user has no allowed sources, skipping', { userId: uid });
      usersSkipped++;
      continue;
    }

    const model = new CupsModel();

    for (const sourceId of allowed) {
      try {
        const r = await importFromIngest({ model, req: fakeReq, sourceId });
        Logger.info('cups cron: source done', {
          userId: uid,
          sourceId,
          parsed: r.parsed,
          created: r.created,
          updated: r.updated,
          softDeleted: r.softDeleted,
          hardDeleted: r.hardDeleted,
          errors: r.errors?.length ?? 0,
        });
        results.push({ userId: uid, sourceId, ...r });
      } catch (e) {
        Logger.error('cups cron: source failed', e, { userId: uid, sourceId });
        results.push({ userId: uid, sourceId, error: e?.message ?? String(e) });
      }
    }
  }

  const totals = results.reduce(
    (acc, r) => {
      acc.parsed += r.parsed ?? 0;
      acc.created += r.created ?? 0;
      acc.updated += r.updated ?? 0;
      acc.skipped += r.skipped ?? 0;
      acc.softDeleted += r.softDeleted ?? 0;
      acc.hardDeleted += r.hardDeleted ?? 0;
      if (r.error || (r.errors && r.errors.length > 0)) acc.errors++;
      return acc;
    },
    { parsed: 0, created: 0, updated: 0, skipped: 0, softDeleted: 0, hardDeleted: 0, errors: 0 },
  );

  Logger.info('cups cron: auto-refresh complete', {
    usersProcessed: users.length - usersSkipped,
    usersSkipped,
    totals,
  });

  return {
    usersProcessed: users.length - usersSkipped,
    usersSkipped,
    results,
    totals,
  };
}

module.exports = { runCupsAutoRefresh };
