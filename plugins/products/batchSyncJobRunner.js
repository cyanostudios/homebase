// plugins/products/batchSyncJobRunner.js
// Worker: DB per product (FOR UPDATE via applyProductBatchPatch), then channels inside batch stock queue.

const { Logger, Context, Database } = require('@homebase/core');
const stockPushQueue = require('./stockPushQueue');
const batchSyncMutex = require('./batchSyncMutex');
const batchSyncStarterQueue = require('./batchSyncStarterQueue');
const ChannelsModel = require('../channels/model');

const BATCH_CHANNEL_META_KEY = '__batchChannel';
const channelsModel = new ChannelsModel();

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(o) {
      this.body = o;
      return this;
    },
  };
}

const EXPORT_TRIGGER_KEYS = new Set([
  'title',
  'description',
  'status',
  'priceAmount',
  'currency',
  'vatRate',
  'mainImage',
  'images',
  'categories',
  'brand',
  'brandId',
  'mpn',
  'ean',
  'gtin',
  'knNumber',
  'channelSpecific',
  'condition',
  'color',
  'colorText',
  'size',
  'sizeText',
  'model',
  'pattern',
  'material',
  'patternText',
  'weight',
  'lengthCm',
  'widthCm',
  'heightCm',
  'depthCm',
  'volume',
  'volumeUnit',
  'notes',
  'privateName',
  'purchasePrice',
  'lagerplats',
  'supplierId',
  'manufacturerId',
  'groupId',
]);

function changesNeedArticleExport(changes) {
  const o = changes && typeof changes === 'object' ? changes : {};
  return Object.keys(o).some((k) => k !== 'quantity' && EXPORT_TRIGGER_KEYS.has(k));
}

function parseJobChanges(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return typeof p === 'object' && p !== null && !Array.isArray(p) ? p : {};
    } catch {
      return {};
    }
  }
  return {};
}

function splitJobPayload(jobRow) {
  const raw = parseJobChanges(jobRow.changes);
  const channelMeta = raw[BATCH_CHANNEL_META_KEY];
  const productPatch = { ...raw };
  delete productPatch[BATCH_CHANNEL_META_KEY];
  return {
    productPatch,
    channelMeta: channelMeta && typeof channelMeta === 'object' ? channelMeta : null,
  };
}

function patchTouchesManagedMedia(productPatch) {
  const patch = productPatch && typeof productPatch === 'object' ? productPatch : {};
  return (
    Object.prototype.hasOwnProperty.call(patch, 'mainImage') ||
    Object.prototype.hasOwnProperty.call(patch, 'images')
  );
}

async function buildBatchPatchWithHostedMedia(
  productController,
  req,
  productId,
  productPatch,
  existingRow,
) {
  const patch = productPatch && typeof productPatch === 'object' ? { ...productPatch } : {};
  if (!patchTouchesManagedMedia(patch)) {
    return patch;
  }
  const existing = existingRow || (await productController.model.getById(req, productId));
  if (!existing) {
    throw new Error('Product not found before media batch patch');
  }
  const hostedMedia = await productController.productMediaService.ensureProductMedia(req, {
    productId,
    mainImage: Object.prototype.hasOwnProperty.call(patch, 'mainImage')
      ? patch.mainImage
      : existing.mainImage,
    images: Object.prototype.hasOwnProperty.call(patch, 'images') ? patch.images : existing.images,
  });
  return {
    ...patch,
    mainImage: hostedMedia.mainImage,
    images: hostedMedia.images,
  };
}

function wooListingExists(externalId) {
  const s = externalId != null ? String(externalId).trim() : '';
  return s !== '' && Number.isFinite(Number(s)) && Number(s) > 0;
}

function cdonOrFyndiqArticleIdLooksValid(raw) {
  const s = raw != null ? String(raw).trim() : '';
  if (!s) return false;
  if (/^\d+$/.test(s)) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return true;
  }
  if (/^[0-9a-f]{32}$/i.test(s)) return true;
  if (/^[0-9a-f]{16}$/i.test(s)) return true;
  return false;
}

function channelMetaHasOverridePayload(meta) {
  const items = meta?.channelOverridesToSave;
  if (!Array.isArray(items)) return false;
  return items.some(
    (o) =>
      o &&
      (o.priceAmount != null ||
        o.salePrice != null ||
        o.originalPrice != null ||
        (o.category != null && String(o.category).trim() !== '')),
  );
}

async function applyBatchChannelEnablesAndOverrides(req, productId, meta, jobErrors) {
  const targets = Array.isArray(meta.channelTargets) ? meta.channelTargets : [];
  for (const t of targets) {
    const ch = String(t.channel || '')
      .trim()
      .toLowerCase();
    if (!ch) continue;
    const instId =
      t.channelInstanceId != null && Number.isFinite(Number(t.channelInstanceId))
        ? Number(t.channelInstanceId)
        : null;
    try {
      await channelsModel.setProductEnabled(req, {
        productId: String(productId),
        channel: ch,
        enabled: true,
        channelInstanceId: instId ?? undefined,
      });
    } catch (e) {
      jobErrors.push({
        productId: String(productId),
        channel: ch,
        message: e?.message || String(e),
      });
    }
  }

  const itemsRaw = Array.isArray(meta.channelOverridesToSave) ? meta.channelOverridesToSave : [];
  if (!itemsRaw.length) return;
  const items = itemsRaw.filter((o) => {
    const id = Number(o?.channelInstanceId);
    return Number.isFinite(id) && id >= 1;
  });
  if (!items.length) return;
  try {
    await channelsModel.upsertProductOverridesBulk(req, { productId: String(productId), items });
  } catch (e) {
    jobErrors.push({
      productId: String(productId),
      channel: 'overrides',
      message: e?.message || String(e),
    });
  }
}

/** Same rules as WooCommerceController.partitionProductsByWooGroup: need groupId + variation type. */
function rowIsVariantGroupMember(row) {
  const gid = row?.groupId != null && String(row.groupId).trim() ? String(row.groupId).trim() : '';
  if (!gid) return false;
  const vt = String(row.groupVariationType || '').toLowerCase();
  return vt === 'color' || vt === 'size' || vt === 'model';
}

/**
 * Full export for one or more MVP payloads (single product or whole variant group).
 * Skips a channel when every product already has a valid listing id for that channel/instance.
 */
async function runFullExportsForPayloads(
  pc,
  req,
  payloads,
  channelMeta,
  jobErrors,
  jobErrorProductId,
) {
  if (!payloads.length) return;
  const targets = Array.isArray(channelMeta.channelTargets) ? channelMeta.channelTargets : [];
  const withMarket = Array.isArray(channelMeta.channelTargetsWithMarket)
    ? channelMeta.channelTargetsWithMarket
    : [];
  const prevBody = req.body;
  const mockRes = createMockRes();
  const errPid = String(jobErrorProductId || payloads[0]?.id || '').trim() || '';

  for (const t of targets) {
    const ch = String(t.channel || '')
      .trim()
      .toLowerCase();
    const instId =
      t.channelInstanceId != null && Number.isFinite(Number(t.channelInstanceId))
        ? Number(t.channelInstanceId)
        : null;

    try {
      if (ch === 'woocommerce' && instId != null) {
        let anyMissing = false;
        for (const p of payloads) {
          const mapRow = await channelsModel.getProductMapRow(
            req,
            String(p.id),
            'woocommerce',
            instId,
          );
          if (!wooListingExists(mapRow?.external_id)) {
            anyMissing = true;
            break;
          }
        }
        if (!anyMissing) continue;
        mockRes.statusCode = 200;
        mockRes.body = null;
        req.body = { products: payloads, instanceIds: [String(instId)] };
        await pc.wooController.exportProducts(req, mockRes);
        if (mockRes.statusCode >= 400) {
          jobErrors.push({
            productId: errPid,
            channel: 'woocommerce',
            message: mockRes.body?.error || `HTTP ${mockRes.statusCode}`,
          });
        }
        continue;
      }

      if (ch === 'cdon') {
        const mapInstId = instId != null && Number.isFinite(Number(instId)) ? Number(instId) : null;
        let anyMissing = false;
        for (const p of payloads) {
          const mapRow = await channelsModel.getProductMapRow(req, String(p.id), 'cdon', mapInstId);
          if (!cdonOrFyndiqArticleIdLooksValid(mapRow?.external_id)) {
            anyMissing = true;
            break;
          }
        }
        if (!anyMissing) continue;
        const markets = [
          ...new Set(
            withMarket
              .filter((x) => String(x.channel || '').toLowerCase() === 'cdon')
              .map((x) =>
                String(x.market || '')
                  .toLowerCase()
                  .slice(0, 2),
              )
              .filter((m) => ['se', 'dk', 'fi', 'no'].includes(m)),
          ),
        ];
        const marketsFilter = markets.length ? markets : ['se'];
        mockRes.statusCode = 200;
        mockRes.body = null;
        req.body = { products: payloads, markets: marketsFilter };
        await pc.cdonController.exportProducts(req, mockRes);
        if (mockRes.statusCode >= 400) {
          jobErrors.push({
            productId: errPid,
            channel: 'cdon',
            message: mockRes.body?.error || `HTTP ${mockRes.statusCode}`,
          });
        }
        continue;
      }

      if (ch === 'fyndiq' && instId != null) {
        let anyMissing = false;
        for (const p of payloads) {
          const mapRow = await channelsModel.getProductMapRow(req, String(p.id), 'fyndiq', instId);
          if (!cdonOrFyndiqArticleIdLooksValid(mapRow?.external_id)) {
            anyMissing = true;
            break;
          }
        }
        if (!anyMissing) continue;
        const markets = [
          ...new Set(
            withMarket
              .filter((x) => String(x.channel || '').toLowerCase() === 'fyndiq')
              .map((x) =>
                String(x.market || '')
                  .toLowerCase()
                  .slice(0, 2),
              )
              .filter((m) => ['se', 'dk', 'fi', 'no'].includes(m)),
          ),
        ];
        const marketsFilter = markets.length ? markets : ['se'];
        mockRes.statusCode = 200;
        mockRes.body = null;
        req.body = {
          products: payloads,
          markets: marketsFilter,
          includePriceAndQuantity: true,
        };
        await pc.fyndiqController.exportProducts(req, mockRes);
        if (mockRes.statusCode >= 400) {
          jobErrors.push({
            productId: errPid,
            channel: 'fyndiq',
            message: mockRes.body?.error || `HTTP ${mockRes.statusCode}`,
          });
        }
      }
    } catch (err) {
      jobErrors.push({
        productId: errPid,
        channel: ch || 'export',
        message: err?.message || String(err),
      });
      Logger.warn('Batch full channel export failed', err, { productId: errPid, channel: ch });
    }
  }

  req.body = prevBody;
}

async function runFullExportsForMissingListings(pc, req, row, channelMeta, jobErrors) {
  const payload = buildExportPayload(row);
  if (!payload) return;
  await runFullExportsForPayloads(pc, req, [payload], channelMeta, jobErrors, String(row.id));
}

function buildExportPayload(row) {
  if (!row) return null;
  return {
    id: row.id,
    sku: row.sku,
    mpn: row.mpn,
    title: row.title,
    status: row.status,
    quantity: row.quantity,
    priceAmount: row.priceAmount,
    currency: row.currency,
    vatRate: row.vatRate,
    description: row.description,
    mainImage: row.mainImage,
    images: row.images,
    categories: row.categories,
    brand: row.brand,
    gtin: row.gtin,
    condition: row.condition,
    knNumber: row.knNumber,
    weight: row.weight ?? null,
    volume: row.volume ?? null,
    volumeUnit: row.volumeUnit ?? null,
    channelSpecific: row.channelSpecific,
    groupId: row.groupId ?? null,
    parentProductId: row.parentProductId,
    groupVariationType: row.groupVariationType,
    color: row.color,
    colorText: row.colorText,
    size: row.size,
    sizeText: row.sizeText,
    model: row.model,
    pattern: row.pattern,
    patternText: row.patternText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function runStrictExportsForProduct(pc, req, row, jobErrors) {
  const payload = buildExportPayload(row);
  if (!payload) return;
  const prevBody = req.body;
  const mockRes = createMockRes();
  try {
    const wooInstances = await pc.wooController.model.listInstances(req);
    const instanceIds = (wooInstances || [])
      .map((x) => x.id)
      .filter((id) => id != null)
      .map((id) => String(id));
    if (instanceIds.length) {
      req.body = {
        mode: 'update_only_strict',
        products: [payload],
        instanceIds,
      };
      await pc.wooController.exportProductsUpdateOnlyStrict(req, mockRes);
      if (mockRes.statusCode >= 400) {
        jobErrors.push({
          productId: String(row.id),
          channel: 'woocommerce',
          message: mockRes.body?.error || `HTTP ${mockRes.statusCode}`,
        });
      }
    }

    req.body = { mode: 'update_only_strict', products: [payload] };
    mockRes.statusCode = 200;
    mockRes.body = null;
    await pc.cdonController.exportProductsUpdateOnlyStrict(req, mockRes);
    if (mockRes.statusCode >= 400) {
      jobErrors.push({
        productId: String(row.id),
        channel: 'cdon',
        message: mockRes.body?.error || `HTTP ${mockRes.statusCode}`,
      });
    }

    req.body = {
      mode: 'update_only_strict',
      products: [payload],
      includePriceAndQuantity: true,
    };
    mockRes.statusCode = 200;
    mockRes.body = null;
    await pc.fyndiqController.exportProductsUpdateOnlyStrict(req, mockRes);
    if (mockRes.statusCode >= 400) {
      jobErrors.push({
        productId: String(row.id),
        channel: 'fyndiq',
        message: mockRes.body?.error || `HTTP ${mockRes.statusCode}`,
      });
    }
  } catch (err) {
    jobErrors.push({
      productId: String(row.id),
      channel: 'export',
      message: err?.message || String(err),
    });
    Logger.warn('Batch job channel export failed', err, { productId: row.id });
  } finally {
    req.body = prevBody;
  }
}

/**
 * @param {import('./controller')} productController
 * @param {object} req
 * @param {string} jobId
 */
async function runBatchSyncJob(productController, req, jobId) {
  const tenantId = req.session?.tenantId;
  const model = productController.model;
  const jid = String(jobId || '').trim();

  const failFinalize = async (fatalErrors, status) => {
    try {
      await model.updateProductBatchSyncJob(req, jid, {
        status,
        errors: fatalErrors,
        completed_at: new Date(),
      });
    } catch (e) {
      Logger.error('Failed to persist batch job failure', e, { jobId: jid });
    }
  };

  try {
    const jobRow = await model.getProductBatchSyncJob(req, jid);
    if (!jobRow) {
      return;
    }

    const productIds = Array.isArray(jobRow.product_ids) ? jobRow.product_ids : [];
    const { productPatch, channelMeta } = splitJobPayload(jobRow);

    const errors = [];
    await model.updateProductBatchSyncJob(req, jid, { status: 'running', errors: [] });

    let processedDb = 0;
    const dbFailed = new Set();

    for (const pid of productIds) {
      const idStr = String(pid).trim();
      try {
        const existingRow = patchTouchesManagedMedia(productPatch)
          ? await model.getById(req, idStr)
          : null;
        const patchForRow = await buildBatchPatchWithHostedMedia(
          productController,
          req,
          idStr,
          productPatch,
          existingRow,
        );
        const r = await model.applyProductBatchPatch(req, idStr, patchForRow);
        if (!r.skipped) {
          processedDb += 1;
        }
        if (patchTouchesManagedMedia(patchForRow)) {
          const savedRow = await model.getById(req, idStr);
          if (savedRow) {
            await productController.reconcileHostedProductMedia(req, savedRow);
          }
        }
        if (channelMeta) {
          await applyBatchChannelEnablesAndOverrides(req, idStr, channelMeta, errors);
        }
        await model.updateProductBatchSyncJob(req, jid, {
          processed_db: processedDb,
          errors,
        });
      } catch (e) {
        dbFailed.add(idStr);
        errors.push({
          productId: idStr,
          channel: 'database',
          message: e?.message || String(e),
        });
        await model.updateProductBatchSyncJob(req, jid, {
          processed_db: processedDb,
          errors,
        });
      }
    }

    const needQty = Object.prototype.hasOwnProperty.call(productPatch, 'quantity');
    const needArticle = changesNeedArticleExport(productPatch);
    const needStrictFromChannels =
      !!channelMeta &&
      (channelMetaHasOverridePayload(channelMeta) ||
        (Array.isArray(channelMeta.channelTargets) && channelMeta.channelTargets.length > 0));

    await stockPushQueue.enqueueBatch(tenantId, async () => {
      const successIds = productIds.map(String).filter((id) => id && !dbFailed.has(id));

      if (
        channelMeta &&
        Array.isArray(channelMeta.channelTargets) &&
        channelMeta.channelTargets.length
      ) {
        const rowById = new Map();
        for (const idStr of successIds) {
          const row = await model.getById(req, idStr);
          if (row) rowById.set(String(row.id), row);
        }
        const processedExportIds = new Set();
        for (const idStr of successIds) {
          if (processedExportIds.has(idStr)) continue;
          const row = rowById.get(idStr);
          if (!row) continue;
          if (rowIsVariantGroupMember(row)) {
            const groupRows = await model.listByGroupId(req, row.groupId);
            for (const r of groupRows) processedExportIds.add(String(r.id));
            const payloads = groupRows.map(buildExportPayload).filter(Boolean);
            if (payloads.length) {
              await runFullExportsForPayloads(
                productController,
                req,
                payloads,
                channelMeta,
                errors,
                String(row.id),
              );
            }
          } else {
            processedExportIds.add(idStr);
            await runFullExportsForMissingListings(
              productController,
              req,
              row,
              channelMeta,
              errors,
            );
          }
        }
      }

      if (needQty && successIds.length) {
        const db = Database.get(req);
        const qtyRows = await db.query(
          `SELECT id::text AS id, quantity, sku FROM products WHERE id::text = ANY($1::text[])`,
          [successIds],
        );
        const qtyById = new Map(qtyRows.map((r) => [String(r.id), r]));
        const stockChannelRowsById = await productController.resolveStockChannelRowsForIds(
          req,
          successIds,
        );

        const cdonItems = [];
        const fyndiqItems = [];
        for (const idStr of successIds) {
          const row = qtyById.get(idStr);
          if (!row) continue;
          const qty = Math.max(0, Math.trunc(Number(row.quantity)));
          const channelRows = stockChannelRowsById.get(idStr) || [];
          let wantsCdon = false;
          let wantsFyndiq = false;
          for (const cr of channelRows) {
            const ch = String(cr.channel || '')
              .trim()
              .toLowerCase();
            if (ch === 'cdon') wantsCdon = true;
            if (ch === 'fyndiq') wantsFyndiq = true;
          }
          if (wantsCdon) {
            cdonItems.push({
              sku: String(idStr),
              quantity: qty,
              productId: String(idStr),
            });
          }
          if (wantsFyndiq) {
            const fyRow = channelRows.find(
              (r) =>
                String(r.channel || '')
                  .trim()
                  .toLowerCase() === 'fyndiq',
            );
            const articleId = fyRow?.external_id != null ? String(fyRow.external_id).trim() : '';
            if (articleId) {
              fyndiqItems.push({
                articleId,
                quantity: qty,
                productId: String(idStr),
              });
            }
          }
        }

        if (cdonItems.length) {
          const { failures } = await productController.cdonController.syncStockBulk(req, cdonItems);
          const failedSku = new Set(failures.map((f) => String(f.sku || '').trim()));
          for (const it of cdonItems) {
            const extRows = stockChannelRowsById.get(it.productId) || [];
            const cdonRow = extRows.find(
              (r) =>
                String(r.channel || '')
                  .trim()
                  .toLowerCase() === 'cdon',
            );
            const externalId =
              cdonRow?.external_id != null ? String(cdonRow.external_id).trim() : null;
            if (failedSku.has(String(it.sku).trim())) {
              const f = failures.find((x) => String(x.sku || '').trim() === String(it.sku).trim());
              await productController.cdonModel.upsertChannelMap(req, {
                productId: it.productId,
                channel: 'cdon',
                enabled: true,
                externalId: externalId ?? String(it.productId),
                status: 'error',
                error: f?.error || 'Stock sync failed',
              });
              errors.push({
                productId: it.productId,
                channel: 'cdon',
                message: f?.error || 'Stock sync failed',
              });
            } else {
              await productController.cdonModel.upsertChannelMap(req, {
                productId: it.productId,
                channel: 'cdon',
                enabled: true,
                externalId: externalId ?? String(it.productId),
                status: 'success',
                error: null,
              });
            }
          }
        }

        if (fyndiqItems.length) {
          const { failures } = await productController.fyndiqController.syncStockBulk(
            req,
            fyndiqItems,
          );
          const failedArt = new Set(failures.map((f) => String(f.articleId || '').trim()));
          for (const it of fyndiqItems) {
            if (failedArt.has(String(it.articleId).trim())) {
              const f = failures.find(
                (x) => String(x.articleId || '').trim() === String(it.articleId).trim(),
              );
              await productController.fyndiqModel.upsertChannelMap(req, {
                productId: it.productId,
                channel: 'fyndiq',
                enabled: true,
                externalId: it.articleId,
                status: 'error',
                error: f?.error || 'Stock sync failed',
              });
              errors.push({
                productId: it.productId,
                channel: 'fyndiq',
                message: f?.error || 'Stock sync failed',
              });
            } else {
              await productController.fyndiqModel.upsertChannelMap(req, {
                productId: it.productId,
                channel: 'fyndiq',
                enabled: true,
                externalId: it.articleId,
                status: 'success',
                error: null,
              });
            }
          }
        }

        for (const idStr of successIds) {
          const row = qtyById.get(idStr);
          if (!row) continue;
          const qty = Math.max(0, Math.trunc(Number(row.quantity)));
          const sku = row.sku != null ? String(row.sku).trim() : '';
          const channelRows = stockChannelRowsById.get(idStr) || [];
          for (const r of channelRows) {
            const channel = String(r.channel || '')
              .trim()
              .toLowerCase();
            if (channel !== 'woocommerce') continue;
            const channelInstanceId =
              r.channel_instance_id != null ? String(r.channel_instance_id) : null;
            await productController.wooController.syncStock(req, {
              productId: String(idStr),
              sku,
              quantity: qty,
              externalId: r.external_id != null ? String(r.external_id) : null,
              channelInstanceId,
            });
          }
        }
      }

      if (needArticle || needStrictFromChannels) {
        for (const idStr of successIds) {
          const row = await model.getById(req, idStr);
          if (!row) continue;
          await runStrictExportsForProduct(productController, req, row, errors);
        }
      }

      const chProcessed = successIds.length;
      await model.updateProductBatchSyncJob(req, jid, {
        processed_channels: chProcessed,
        errors,
      });
    });

    await model.updateProductBatchSyncJob(req, jid, {
      status: 'completed',
      errors,
      completed_at: new Date(),
    });
  } catch (err) {
    Logger.error('Batch sync job crashed', err, { jobId: jid, userId: Context.getUserId(req) });
    await failFinalize(
      [
        {
          productId: '',
          channel: 'job',
          message: err?.message || String(err),
        },
      ],
      'failed',
    );
    return;
  } finally {
    batchSyncMutex.releaseIfMatches(tenantId, jid);
    batchSyncStarterQueue.onBatchFinished(tenantId);
  }
}

module.exports = {
  runBatchSyncJob,
  changesNeedArticleExport,
  patchTouchesManagedMedia,
  buildBatchPatchWithHostedMedia,
};
