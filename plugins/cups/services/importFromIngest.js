const IngestModel = require('../../ingest/model');
const ingestService = require('../../ingest/services/ingestService');
const { AppError } = require('../../../server/core/errors/AppError');
const { parseCupSource } = require('./parseCupSource');
const { Logger, Context } = require('@homebase/core');
const ServiceManager = require('../../../server/core/ServiceManager');

const MIN_ITEMS_FOR_SWEEP = 3;

/**
 * When Cups settings have a non-empty allowedIngestSourceIds list, reject imports
 * of sources not on that list. Empty/missing list = allow (UI-compatible).
 * Cron already loops only allowed ids; this enforces the same gate for the API.
 *
 * @param {import('express').Request} req
 * @param {number} sourceId
 */
async function assertIngestSourceAllowedForCups(req, sourceId) {
  const userId =
    Context.getUserId(req) ?? req?.session?.user?.id ?? req?.session?.currentTenantUserId;
  if (userId == null) {
    throw new AppError('User context required for import', 400, AppError.CODES.BAD_REQUEST);
  }

  let settings = {};
  try {
    const mainPool = ServiceManager.getMainPool();
    const result = await mainPool.query(
      `SELECT settings FROM user_settings WHERE user_id = $1 AND category = $2`,
      [Number(userId), 'cups'],
    );
    settings = result.rows.length ? result.rows[0].settings || {} : {};
  } catch (e) {
    Logger.warn('cups import: failed to load allowlist settings — allowing import', {
      error: e?.message,
      userId,
    });
    return;
  }

  const allowed = Array.isArray(settings?.allowedIngestSourceIds)
    ? settings.allowedIngestSourceIds.map(String)
    : [];
  if (allowed.length === 0) {
    return;
  }
  if (!allowed.includes(String(sourceId))) {
    throw new AppError(
      'This ingest source is not enabled for Cups. Enable it in Cups settings.',
      403,
      AppError.CODES.FORBIDDEN,
    );
  }
}

/**
 * Import cups from one ingest source id.
 * After a successful import (fetch ok, parsed >= MIN, no save errors) the function
 * soft-deletes cups for this source that were NOT seen during this run, then
 * hard-deletes any that have been soft-deleted for more than 30 days.
 *
 * @param {{ model: any, req: import('express').Request, sourceId: string|number }} params
 */
async function importFromIngest({ model, req, sourceId }) {
  const parsedSourceId = parseInt(String(sourceId), 10);
  if (Number.isNaN(parsedSourceId)) {
    throw new AppError('Invalid ingest source id', 400, AppError.CODES.BAD_REQUEST);
  }

  await assertIngestSourceAllowedForCups(req, parsedSourceId);

  const ingestModel = new IngestModel();
  const source = await ingestModel.getSourceById(req, parsedSourceId);
  if (!source) {
    throw new AppError('Ingest source not found', 404, AppError.CODES.NOT_FOUND);
  }

  // Record the timestamp before any upserts so the sweep can compare last_seen_at < runStartedAt.
  const runStartedAt = new Date();

  const fetchResult = await ingestService.fetchSourceFromRecord(req, source);
  if (!fetchResult?.ok || !fetchResult?.bodyText) {
    return {
      sourceId: String(parsedSourceId),
      fetched: false,
      parsed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      softDeleted: 0,
      restored: 0,
      hardDeleted: 0,
      errors: [fetchResult?.errorMessage || 'Failed to fetch source'],
    };
  }

  const parsedItems = parseCupSource({
    html: fetchResult.bodyText,
    sourceUrl: source.sourceUrl,
    sourceType: source.sourceType,
  });

  const saveResult = await model.createManyFromImport(req, parsedItems, {
    sourceUrl: source.sourceUrl,
    sourceType: source.sourceType,
    ingestSourceId: source.id,
  });

  let softDeleted = 0;
  let hardDeleted = 0;

  const sweepEligible =
    fetchResult.ok && parsedItems.length >= MIN_ITEMS_FOR_SWEEP && saveResult.errors.length === 0;

  if (sweepEligible) {
    try {
      softDeleted = await model.softDeleteMissingForSource(req, parsedSourceId, runStartedAt);
    } catch (sweepError) {
      Logger.warn('cups sweep (soft delete) failed — skipping', { error: sweepError?.message });
    }
    try {
      hardDeleted = await model.hardDeleteExpiredForSource(req, parsedSourceId, 30);
    } catch (retentionError) {
      Logger.warn('cups retention (hard delete) failed — skipping', {
        error: retentionError?.message,
      });
    }
  }

  return {
    sourceId: String(parsedSourceId),
    fetched: true,
    parsed: parsedItems.length,
    created: saveResult.created,
    updated: saveResult.updated,
    skipped: saveResult.skipped,
    softDeleted,
    restored: saveResult.restored ?? 0,
    hardDeleted,
    errors: saveResult.errors,
    diagnostics: {
      status: fetchResult.status ?? null,
      finalUrl: fetchResult.finalUrl ?? null,
      contentType: fetchResult.contentType ?? null,
      sweepEligible,
    },
  };
}

module.exports = { importFromIngest, assertIngestSourceAllowedForCups, MIN_ITEMS_FOR_SWEEP };
