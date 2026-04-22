// Async worker: reads stored job file, runs importRowsCore under productImportLock.

const { Logger } = require('@homebase/core');

const batchSyncMutex = require('./batchSyncMutex');
const productImportLock = require('./productImportLock');
const importStorage = require('./importStorage');
const importParse = require('./importParse');

const BATCH_WAIT_POLL_MS = 400;

/**
 * Import must not run concurrently with an active batch-sync job (same tenant, same products possible).
 * Wait until batch channel/DB phase has released the mutex — before taking productImportLock.
 */
async function waitForBatchSyncIdle(tenantId) {
  const tid = String(tenantId ?? '').trim();
  if (!tid) return;
  let activeId = batchSyncMutex.getActiveJobId(tid);
  if (!activeId) return;
  Logger.info('Product import waiting for batch sync job to finish', {
    tenantId: tid,
    batchJobId: activeId,
  });
  while (activeId) {
    await new Promise((r) => setTimeout(r, BATCH_WAIT_POLL_MS));
    activeId = batchSyncMutex.getActiveJobId(tid);
  }
}

/**
 * @param {import('./controller')} controller
 * @param {object} req
 * @param {string} jobId
 */
async function runProductImportJob(controller, req, jobId) {
  const jid = String(jobId || '').trim();
  if (!jid) return;

  const tenantId = req.session?.tenantId;
  let lockHeld = false;

  try {
    const job = await controller.model.getProductImportJob(req, jid);
    if (!job) {
      return;
    }

    if (!job.storage_path) {
      await controller.model.updateProductImportJob(req, jid, {
        status: 'failed',
        last_error: 'Missing file',
        finished_at: new Date(),
      });
      return;
    }

    if (tenantId) {
      await waitForBatchSyncIdle(tenantId);
      productImportLock.begin(tenantId);
      lockHeld = true;
    }

    await controller.model.updateProductImportJob(req, jid, { status: 'running' });

    const buf = await importStorage.readJobFile(job.storage_path);
    const isCsv = importParse.isCsvFile(job.mime_type, job.original_filename);
    const rawRows = isCsv
      ? await importParse.parseCsvBuffer(buf)
      : importParse.parseXlsxBuffer(buf);

    const mode = job.mode;
    const matchKey = job.match_key || 'sku';

    const onRowProcessed = async (_rowNum, snap) => {
      const errCount =
        snap.skippedInvalid +
        snap.skippedMissingKey +
        snap.notFound +
        snap.conflicts +
        snap.skippedMissingSku;
      await controller.model.updateProductImportJob(req, jid, {
        processed_rows: snap.processedRows,
        created_count: snap.created,
        updated_count: snap.updated,
        error_count: errCount,
        skipped_missing_key: snap.skippedMissingKey,
        skipped_invalid: snap.skippedInvalid,
        conflicts_count: snap.conflicts,
        not_found_count: snap.notFound,
      });
    };

    const result = await controller.importRowsCore(req, rawRows, mode, matchKey, onRowProcessed);

    const errCount =
      result.skippedInvalid.length +
      result.skippedMissingKey.length +
      result.notFound.length +
      result.conflicts.length +
      result.skippedMissingSku.length;

    await controller.model.updateProductImportJob(req, jid, {
      status: 'completed',
      processed_rows: rawRows.length,
      created_count: result.created,
      updated_count: result.updated,
      error_count: errCount,
      skipped_missing_key: result.skippedMissingKey.length,
      skipped_invalid: result.skippedInvalid.length,
      conflicts_count: result.conflicts.length,
      not_found_count: result.notFound.length,
      finished_at: new Date(),
    });
  } catch (err) {
    Logger.error('runProductImportJob', err, { jobId: jid });
    try {
      await controller.model.updateProductImportJob(req, jid, {
        status: 'failed',
        last_error: String(err?.message || err),
        finished_at: new Date(),
      });
    } catch (e2) {
      Logger.error('runProductImportJob finalize failed', e2);
    }
  } finally {
    if (lockHeld && tenantId) {
      productImportLock.end(tenantId);
    }
  }
}

module.exports = { runProductImportJob, waitForBatchSyncIdle };
