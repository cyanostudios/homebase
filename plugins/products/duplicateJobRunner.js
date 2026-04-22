// Async worker: duplicate products (optional media) under productImportLock.

const { Logger } = require('@homebase/core');

const { AppError } = require('../../server/core/errors/AppError');

const productImportLock = require('./productImportLock');
const { waitForBatchSyncIdle } = require('./importJobRunner');
const duplicateMediaTaskModel = require('./duplicateMediaTaskModel');

function sortGroupMembersForDuplicate(members, gid) {
  const g = String(gid ?? '').trim();
  const main = members.find((m) => String(m.id) === g) || members[0];
  const rest = members.filter((m) => String(m.id) !== String(main.id));
  return [main, ...rest];
}

/**
 * @param {object} req
 * @param {import('./controller')} controller
 * @param {string} jid
 * @param {boolean} copyMedia
 * @param {string} sourceIdStr
 * @param {{ id: string|number }} createdProduct
 */
async function maybeEnqueueDuplicateMediaTask(
  req,
  controller,
  jid,
  copyMedia,
  sourceIdStr,
  createdProduct,
) {
  if (!copyMedia || !createdProduct?.id) {
    return;
  }
  const srcNum = parseInt(String(sourceIdStr).trim(), 10);
  const dstNum = parseInt(String(createdProduct.id).trim(), 10);
  if (!Number.isFinite(srcNum) || !Number.isFinite(dstNum)) {
    return;
  }
  if (!(await duplicateMediaTaskModel.sourceHasManagedMediaWithContentHash(req, srcNum))) {
    return;
  }
  await duplicateMediaTaskModel.insertDuplicateMediaTask(req, jid, srcNum, dstNum);
}

/**
 * @param {import('./controller')} controller
 * @param {boolean} copyMedia
 * @param {object} extras
 */
function buildDuplicateOptions(controller, copyMedia, extras = {}) {
  return {
    copyMedia,
    deferMediaCopy: copyMedia === true,
    mediaService: controller.productMediaService,
    ...extras,
  };
}

/**
 * @param {import('./controller')} controller
 * @param {object} req
 * @param {string} jobId
 */
async function runProductDuplicateJob(controller, req, jobId) {
  const jid = String(jobId || '').trim();
  if (!jid) return;

  const tenantId = req.session?.tenantId;
  let lockHeld = false;

  try {
    const job = await controller.model.getProductDuplicateJob(req, jid);
    if (!job) {
      return;
    }

    const payloadRaw = job.payload;
    const payload =
      typeof payloadRaw === 'string'
        ? (() => {
            try {
              return JSON.parse(payloadRaw);
            } catch {
              return {};
            }
          })()
        : payloadRaw && typeof payloadRaw === 'object'
          ? payloadRaw
          : {};

    const productIds = Array.isArray(payload.productIds) ? payload.productIds : [];
    const copyMedia = payload.copyMedia === true;
    const selectedOrder = productIds.map((x) => String(x).trim()).filter(Boolean);
    const selectedSet = new Set(selectedOrder.map(String));

    if (tenantId) {
      await waitForBatchSyncIdle(tenantId);
      productImportLock.begin(tenantId);
      lockHeld = true;
    }

    await controller.model.updateProductDuplicateJob(req, jid, {
      status: 'running',
      phase: 'products',
    });

    const processedOld = new Set();
    const createdIds = [];
    const errors = [];
    let created = 0;
    let errs = 0;
    let proc = 0;

    const persistProgress = async () => {
      await controller.model.updateProductDuplicateJob(req, jid, {
        processed_products: proc,
        created_count: created,
        error_count: errs,
        result: { createdIds, errors },
      });
    };

    for (const id of selectedOrder) {
      const idStr = String(id).trim();
      if (!idStr || processedOld.has(idStr)) {
        continue;
      }

      const p = await controller.model.getById(req, idStr);
      if (!p) {
        errs += 1;
        errors.push({ sourceId: idStr, error: 'not_found' });
        proc += 1;
        processedOld.add(idStr);
        await persistProgress();
        continue;
      }

      const gid =
        p.groupId != null && String(p.groupId).trim() !== '' ? String(p.groupId).trim() : null;

      if (!gid) {
        try {
          const c = await controller.model.duplicateProductFromSource(
            req,
            idStr,
            buildDuplicateOptions(controller, copyMedia, { stripAllGroup: true }),
          );
          created += 1;
          createdIds.push({ sourceId: idStr, newId: String(c.id) });
          await maybeEnqueueDuplicateMediaTask(req, controller, jid, copyMedia, idStr, c);
        } catch (e) {
          errs += 1;
          errors.push({ sourceId: idStr, error: String(e?.message || e) });
        }
        proc += 1;
        processedOld.add(idStr);
        await persistProgress();
        continue;
      }

      const members = await controller.model.listByGroupId(req, gid);
      const memberSet = new Set(members.map((m) => String(m.id)));
      const complete = members.every((m) => selectedSet.has(String(m.id)));

      if (!complete) {
        const selectedInGroup = selectedOrder.filter(
          (sid) => memberSet.has(String(sid)) && !processedOld.has(String(sid)),
        );
        for (const mid of selectedInGroup) {
          try {
            const c = await controller.model.duplicateProductFromSource(
              req,
              mid,
              buildDuplicateOptions(controller, copyMedia, { stripAllGroup: true }),
            );
            created += 1;
            createdIds.push({ sourceId: mid, newId: String(c.id) });
            await maybeEnqueueDuplicateMediaTask(req, controller, jid, copyMedia, mid, c);
          } catch (e) {
            errs += 1;
            errors.push({ sourceId: mid, error: String(e?.message || e) });
          }
          proc += 1;
          processedOld.add(String(mid));
          await persistProgress();
        }
        continue;
      }

      const sorted = sortGroupMembersForDuplicate(members, gid);
      const mainOld = sorted[0];
      const mainOldId = String(mainOld.id);

      let newMain = null;
      try {
        newMain = await controller.model.duplicateProductFromSource(
          req,
          mainOldId,
          buildDuplicateOptions(controller, copyMedia, {
            stripAllGroup: false,
            stripGroupLinksOnly: true,
          }),
        );
        await controller.model.setDuplicateMainGroupAnchor(req, newMain.id);
        created += 1;
        createdIds.push({ sourceId: mainOldId, newId: String(newMain.id) });
        await maybeEnqueueDuplicateMediaTask(req, controller, jid, copyMedia, mainOldId, newMain);
      } catch (e) {
        errs += 1;
        errors.push({ sourceId: mainOldId, error: String(e?.message || e) });
      }
      proc += 1;
      processedOld.add(mainOldId);
      await persistProgress();

      if (!newMain) {
        for (const m of members) {
          const mid = String(m.id);
          if (mid !== mainOldId) {
            processedOld.add(mid);
            proc += 1;
          }
        }
        await persistProgress();
        continue;
      }

      for (const childOld of sorted.slice(1)) {
        const cid = String(childOld.id);
        if (processedOld.has(cid)) {
          continue;
        }
        try {
          const c = await controller.model.duplicateProductFromSource(
            req,
            cid,
            buildDuplicateOptions(controller, copyMedia, {
              stripAllGroup: false,
              groupId: String(newMain.id),
              parentProductId: String(newMain.id),
              groupVariationType: childOld.groupVariationType,
            }),
          );
          created += 1;
          createdIds.push({ sourceId: cid, newId: String(c.id) });
          await maybeEnqueueDuplicateMediaTask(req, controller, jid, copyMedia, cid, c);
        } catch (e) {
          errs += 1;
          errors.push({ sourceId: cid, error: String(e?.message || e) });
        }
        proc += 1;
        processedOld.add(cid);
        await persistProgress();
      }

      for (const m of members) {
        processedOld.add(String(m.id));
      }
      await persistProgress();
    }

    const mediaTotal = await duplicateMediaTaskModel.countTasksForJob(req, jid);
    await controller.model.updateProductDuplicateJob(req, jid, {
      phase: mediaTotal > 0 ? 'media' : 'done',
      products_completed_at: new Date(),
      media_total: mediaTotal,
      media_processed: 0,
      media_error_count: 0,
    });
    await persistProgress();

    let lastMediaError = null;
    let mediaErrorCount = 0;

    if (mediaTotal > 0) {
      await duplicateMediaTaskModel.reclaimStaleRunningTasks(req, 30);
      let mediaProcessed = 0;
      while (true) {
        const next = await duplicateMediaTaskModel.claimNextQueuedTaskForJob(req, jid);
        if (!next) {
          break;
        }
        try {
          const canonical =
            await controller.productMediaService.duplicateManagedMediaBetweenProducts(
              req,
              next.source_product_id,
              next.dest_product_id,
            );
          const destRows = await controller.productMediaService.mediaObjectModel.listByProductId(
            req,
            next.dest_product_id,
          );
          if (!destRows.length) {
            throw new AppError(
              'Mediakopiering gav inga bilder på målprodukten',
              500,
              AppError.CODES.INTERNAL_ERROR,
            );
          }
          await controller.model.updateProductCanonicalImagesAfterMediaDuplicate(
            req,
            next.dest_product_id,
            canonical,
          );
          await duplicateMediaTaskModel.markTaskCompleted(req, String(next.id));
        } catch (e) {
          mediaErrorCount += 1;
          const msg = String(e?.message || e);
          lastMediaError = msg;
          await duplicateMediaTaskModel.markTaskFailed(req, String(next.id), msg);
          Logger.warn('Deferred duplicate media task failed', { taskId: next.id, error: msg });
        }
        mediaProcessed += 1;
        await controller.model.updateProductDuplicateJob(req, jid, {
          media_processed: mediaProcessed,
          media_error_count: mediaErrorCount,
        });
        await persistProgress();
      }
    }

    const lastErrorFinal =
      errs > 0 && errors.length
        ? errors[errors.length - 1].error
        : mediaErrorCount > 0
          ? lastMediaError
          : null;

    await controller.model.updateProductDuplicateJob(req, jid, {
      phase: 'done',
      status: 'completed',
      completed_at: new Date(),
      processed_products: proc,
      created_count: created,
      error_count: errs,
      last_error: lastErrorFinal,
      result: { createdIds, errors },
    });
  } catch (err) {
    Logger.error('runProductDuplicateJob', err, { jobId: jid });
    try {
      await controller.model.updateProductDuplicateJob(req, jid, {
        status: 'failed',
        last_error: String(err?.message || err),
        completed_at: new Date(),
      });
    } catch (e2) {
      Logger.error('runProductDuplicateJob finalize failed', e2);
    }
  } finally {
    if (lockHeld && tenantId) {
      productImportLock.end(tenantId);
    }
  }
}

module.exports = { runProductDuplicateJob };
