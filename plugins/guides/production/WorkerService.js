// plugins/guides/production/WorkerService.js
const os = require('os');
const { Logger } = require('@homebase/core');
const ServiceManager = require('../../../server/core/ServiceManager');
const SupervisorService = require('./SupervisorService');
const ProductionSettingsModel = require('./ProductionSettingsModel');
const { createWorkerReq } = require('./workerContext');
const { getProductionSettingsBustAt } = require('./productionSettingsCache');
const { listGuidesEnabledTenants } = require('./listGuidesEnabledTenants');

const DEFAULT_POLL_MS = Number(process.env.GUIDES_PRODUCTION_WORKER_POLL_MS) || 5000;
/** How long to trust cached tenant settings while the worker is ON. Off is cached until UI bust. */
const SETTINGS_CACHE_TTL_MS = Number(process.env.GUIDES_PRODUCTION_SETTINGS_CACHE_MS) || 10000;

function isWorkerEnabled() {
  const raw = process.env.GUIDES_PRODUCTION_WORKER_ENABLED;
  if (raw === undefined || raw === '') {
    return process.env.NODE_ENV !== 'test';
  }
  return raw === '1' || raw === 'true';
}

class WorkerService {
  /**
   * @param {import('./ProductionOrchestrationService')} productionOrchestration
   * @param {import('./ProductionSettingsModel')} [productionSettingsModel]
   * @param {{ ignoreTenantSettings?: boolean }} [options]
   */
  constructor(
    productionOrchestration,
    productionSettingsModel = new ProductionSettingsModel(),
    options = {},
  ) {
    this.productionOrchestration = productionOrchestration;
    this.productionSettingsModel = productionSettingsModel;
    this.ignoreTenantSettings = Boolean(options.ignoreTenantSettings);
    this.supervisor = new SupervisorService(productionOrchestration.jobModel);
    this.workerId = `${os.hostname()}-${process.pid}`;
    this.intervalId = null;
    this.parked = false;
    this.tickInProgress = false;
    /** @type {Map<number, { settings: { workerEnabled: boolean, pollIntervalMs: number }, fetchedAt: number }>} */
    this.settingsCache = new Map();
    /** @type {Map<number, number>} */
    this.lastProcessedAt = new Map();
  }

  start() {
    if (!isWorkerEnabled()) {
      Logger.info('Guides production worker disabled');
      return;
    }
    this.parked = false;
    this._ensureInterval();
    void this.tick();
  }

  stop() {
    this._clearInterval();
    this.parked = true;
    this.settingsCache.clear();
    this.lastProcessedAt.clear();
    Logger.info('Guides production worker stopped', { workerId: this.workerId });
  }

  /**
   * UI / API saved production settings. Enable wakes the poll loop; disable parks it
   * when no tenant still has the worker on.
   * @param {number|string} userId
   * @param {{ workerEnabled?: boolean, pollIntervalMs?: number }} settings
   */
  notifySettingsChanged(userId, settings) {
    if (!isWorkerEnabled() || this.ignoreTenantSettings) return;
    const id = Number(userId);
    if (!Number.isFinite(id) || !settings) return;

    this.settingsCache.set(id, {
      settings: {
        workerEnabled: Boolean(settings.workerEnabled),
        pollIntervalMs: Number(settings.pollIntervalMs) || 5000,
      },
      fetchedAt: Date.now(),
    });

    if (settings.workerEnabled) {
      this.parked = false;
      this._ensureInterval();
      void this.tick();
      return;
    }

    if (this.intervalId) {
      void this.tick();
    }
  }

  async tick() {
    if (this.tickInProgress) return;
    this.tickInProgress = true;

    try {
      const tenants = await this._listTenants();
      const connectionPool = ServiceManager.get('connectionPool');
      const now = Date.now();
      let anyEnabled = false;

      for (const tenant of tenants) {
        const connectionString = tenant.connection_string || tenant.neon_connection_string;
        if (!connectionString) continue;

        const userId = Number(tenant.user_id);
        if (!Number.isFinite(userId)) continue;

        try {
          if (!this.ignoreTenantSettings) {
            const settings = await this._getCachedSettings(userId, now, () => {
              const tenantPool = connectionPool.getTenantPool(connectionString);
              return createWorkerReq(tenantPool, userId);
            });
            if (!settings.workerEnabled) {
              continue;
            }
            anyEnabled = true;

            const lastAt = this.lastProcessedAt.get(userId) || 0;
            if (now - lastAt < settings.pollIntervalMs) {
              continue;
            }
          } else {
            anyEnabled = true;
          }

          const tenantPool = connectionPool.getTenantPool(connectionString);
          const req = createWorkerReq(tenantPool, userId);

          await this.supervisor.releaseStuckItems(req);
          const itemsProcessed = await this.productionOrchestration.runWorkerTick(req);
          await this.productionOrchestration.jobModel.upsertWorkerHeartbeat(
            req,
            this.workerId,
            itemsProcessed,
          );
          this.lastProcessedAt.set(userId, now);
        } catch (error) {
          Logger.error('Guides production worker tenant tick failed', error, {
            userId: tenant.user_id,
          });
        }
      }

      if (!this.ignoreTenantSettings) {
        if (!anyEnabled) {
          this._park();
        } else {
          this.parked = false;
          this._ensureInterval();
        }
      }
    } catch (error) {
      Logger.error('Guides production worker tick failed', error);
    } finally {
      this.tickInProgress = false;
    }
  }

  /**
   * @param {number} userId
   * @param {number} now
   * @param {() => ReturnType<typeof createWorkerReq>} getReq
   */
  async _getCachedSettings(userId, now, getReq) {
    const cached = this.settingsCache.get(userId);
    const bustAt = getProductionSettingsBustAt(userId);
    if (cached && cached.fetchedAt >= bustAt) {
      if (!cached.settings.workerEnabled) {
        return cached.settings;
      }
      if (now - cached.fetchedAt < SETTINGS_CACHE_TTL_MS) {
        return cached.settings;
      }
    }

    const settings = await this.productionSettingsModel.get(getReq());
    this.settingsCache.set(userId, { settings, fetchedAt: now });
    return settings;
  }

  async _listTenants() {
    const mainPool = ServiceManager.getMainPool();
    return listGuidesEnabledTenants(mainPool);
  }

  _ensureInterval() {
    if (this.intervalId) return;
    const pollMs = Math.max(1000, Math.min(DEFAULT_POLL_MS, 5000));
    Logger.info('Guides production worker starting', {
      workerId: this.workerId,
      pollMs,
    });
    this.intervalId = setInterval(() => {
      void this.tick();
    }, pollMs);
    if (typeof this.intervalId.unref === 'function') {
      this.intervalId.unref();
    }
  }

  _park() {
    const wasPolling = Boolean(this.intervalId);
    this._clearInterval();
    if (!this.parked || wasPolling) {
      this.parked = true;
      Logger.info('Guides production worker parked', { workerId: this.workerId });
    } else {
      this.parked = true;
    }
  }

  _clearInterval() {
    if (!this.intervalId) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }
}

module.exports = { WorkerService, isWorkerEnabled };
