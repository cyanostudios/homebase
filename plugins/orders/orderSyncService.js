// plugins/orders/orderSyncService.js
// Central order sync: used by quick-sync endpoint and scheduler. Per-slot locking via trySetRunning.

const { Logger } = require('@homebase/core');

const orderSyncState = require('./orderSyncState');
const CdonProductsController = require('../cdon-products/controller');
const CdonProductsModel = require('../cdon-products/model');
const FyndiqProductsController = require('../fyndiq-products/controller');
const FyndiqProductsModel = require('../fyndiq-products/model');
const WooCommerceController = require('../woocommerce-products/controller');
const WooCommerceModel = require('../woocommerce-products/model');

const cdonModel = new CdonProductsModel();
const cdonController = new CdonProductsController(cdonModel);
const fyndiqModel = new FyndiqProductsModel();
const fyndiqController = new FyndiqProductsController(fyndiqModel);
const wooModel = new WooCommerceModel();
const wooController = new WooCommerceController(wooModel);

const SYNC_INTERVAL_MINUTES = 15;

/**
 * Run sync for one slot. Caller must have claimed the slot with trySetRunning.
 * Updates order_sync_state on success/error and clears running_since.
 */
async function runSyncForSlot(req, slot) {
  const { channel, channelInstanceId, settings = null, instance = null } = slot;
  const instId = channelInstanceId != null ? Number(channelInstanceId) : null;

  try {
    if (channel === 'cdon') {
      const result = await cdonController.syncOpenOrders(req, settings);
      if (result.error) {
        await orderSyncState.setError(req, 'cdon', null, result.error);
        return;
      }
      await orderSyncState.setSuccess(req, 'cdon', null, {
        nextRunAt: new Date(Date.now() + SYNC_INTERVAL_MINUTES * 60 * 1000),
      });
      Logger.info('Order sync slot completed', {
        userId: req.session?.user?.id,
        channel: 'cdon',
        fetched: result.fetched ?? 0,
        created: result.created ?? 0,
        changed: result.changed ?? 0,
        skipped: result.skipped ?? 0,
        pagesFetched: result.pagesFetched ?? 0,
        inventoryUpdatedProducts: result.inventoryUpdatedProducts ?? 0,
      });
      return;
    }

    if (channel === 'fyndiq') {
      const result = await fyndiqController.syncOpenOrders(req, settings);
      if (result.error) {
        await orderSyncState.setError(req, 'fyndiq', null, result.error);
        return;
      }
      await orderSyncState.setSuccess(req, 'fyndiq', null, {
        nextRunAt: new Date(Date.now() + SYNC_INTERVAL_MINUTES * 60 * 1000),
      });
      Logger.info('Order sync slot completed', {
        userId: req.session?.user?.id,
        channel: 'fyndiq',
        fetched: result.fetched ?? 0,
        created: result.created ?? 0,
        changed: result.changed ?? 0,
        skipped: result.skipped ?? 0,
        pagesFetched: result.pagesFetched ?? 0,
        inventoryUpdatedProducts: result.inventoryUpdatedProducts ?? 0,
      });
      return;
    }

    if (channel === 'woocommerce' && instId != null) {
      if (!instance) {
        await orderSyncState.setError(req, 'woocommerce', instId, 'Instance not found');
        return;
      }
      const state = await orderSyncState.getState(req, 'woocommerce', instId);
      let after = null;
      if (state?.last_cursor_placed_at) {
        const last = new Date(state.last_cursor_placed_at);
        if (!Number.isNaN(last.getTime())) {
          const now = Date.now();
          // If cursor is in the future (clock drift or bad data), ignore it and re-sync.
          if (last.getTime() <= now + 5 * 60 * 1000) {
            after = new Date(last.getTime() - 2 * 60 * 1000).toISOString();
          } else {
            Logger.warn('Woo last_cursor_placed_at is in the future; ignoring cursor', {
              channelInstanceId: instId,
              lastCursorPlacedAt: state.last_cursor_placed_at,
            });
          }
        }
      }
      const result = await wooController.syncOpenOrdersForInstance(req, instance, after);
      if (result.error) {
        await orderSyncState.setError(req, 'woocommerce', instId, result.error);
        return;
      }
      await orderSyncState.setSuccess(req, 'woocommerce', instId, {
        lastCursorPlacedAt: result.lastCursor || state?.last_cursor_placed_at,
        nextRunAt: new Date(Date.now() + SYNC_INTERVAL_MINUTES * 60 * 1000),
      });
      Logger.info('Order sync slot completed', {
        userId: req.session?.user?.id,
        channel: 'woocommerce',
        channelInstanceId: instId,
        fetched: result.fetched ?? 0,
        created: result.created ?? 0,
        changed: result.changed ?? 0,
        skipped: result.skipped ?? 0,
        pagesFetched: result.pagesFetched ?? 0,
        inventoryUpdatedProducts: result.inventoryUpdatedProducts ?? 0,
      });
      return;
    }
  } catch (err) {
    Logger.error('Order sync slot failed', err, { channel, channelInstanceId: instId });
    await orderSyncState.setError(req, channel, instId, err?.message || String(err));
  }
}

/**
 * Collect all (channel, channel_instance_id) slots for this user that have config.
 */
async function getSlotsToSync(req) {
  const slots = [];

  try {
    const cdonSettings = await cdonModel.getSettings(req);
    if (cdonSettings?.apiKey && cdonSettings?.apiSecret) {
      slots.push({ channel: 'cdon', channelInstanceId: null, settings: cdonSettings });
    }
  } catch (_) {}

  try {
    const fyndiqSettings = await fyndiqModel.getSettings(req);
    if (fyndiqSettings?.apiKey && fyndiqSettings?.apiSecret) {
      slots.push({ channel: 'fyndiq', channelInstanceId: null, settings: fyndiqSettings });
    }
  } catch (_) {}

  try {
    const wooInstances = await wooModel.listInstances(req);
    for (const inst of wooInstances || []) {
      let creds = inst?.credentials;
      if (typeof creds === 'string') {
        try {
          creds = JSON.parse(creds);
        } catch {
          creds = {};
        }
      }
      creds = creds || {};
      if (creds.storeUrl || creds.store_url) {
        const instId = inst.id != null ? Number(inst.id) : null;
        if (instId != null)
          slots.push({ channel: 'woocommerce', channelInstanceId: instId, instance: inst });
      }
    }
  } catch (_) {}

  return slots;
}

/**
 * Run full sync for the current user (all configured slots). Skips slots already running.
 * Call this from a background task after returning quick-sync response.
 */
async function runSync(req) {
  const slots = await getSlotsToSync(req);
  for (const slot of slots) {
    const claimed = await orderSyncState.trySetRunning(req, slot.channel, slot.channelInstanceId);
    if (!claimed) continue;
    await runSyncForSlot(req, slot);
  }
}

module.exports = {
  runSync,
  runSyncForSlot,
  getSlotsToSync,
  SYNC_INTERVAL_MINUTES,
};
