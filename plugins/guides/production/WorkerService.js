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
/** How long to trust cached tenant settings before re-reading from DB. */
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

    void this.tick();
  }

  stop() {
    if (!this.intervalId) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.settingsCache.clear();
    this.lastProcessedAt.clear();
    Logger.info('Guides production worker stopped', { workerId: this.workerId });
  }

  async tick() {
    if (this.tickInProgress) return;
    this.tickInProgress = true;

    try {
      const tenants = await this._listTenants();
      const connectionPool = ServiceManager.get('connectionPool');
      const now = Date.now();

      for (const tenant of tenants) {
        const connectionString = tenant.connection_string || tenant.neon_connection_string;
        if (!connectionString) continue;

        const userId = Number(tenant.user_id);
        const tenantPool = connectionPool.getTenantPool(connectionString);
        const req = createWorkerReq(tenantPool, userId);

        try {
          if (!this.ignoreTenantSettings) {
            const settings = await this._getCachedSettings(req, userId, now);
            if (!settings.workerEnabled) {
              continue;
            }

            const lastAt = this.lastProcessedAt.get(userId) || 0;
            if (now - lastAt < settings.pollIntervalMs) {
              continue;
            }
          }

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
    } catch (error) {
      Logger.error('Guides production worker tick failed', error);
    } finally {
      this.tickInProgress = false;
    }
  }

  /**
   * @param {ReturnType<typeof createWorkerReq>} req
   * @param {number} userId
   * @param {number} now
   */
  async _getCachedSettings(req, userId, now) {
    const cached = this.settingsCache.get(userId);
    const bustAt = getProductionSettingsBustAt(userId);
    if (cached && cached.fetchedAt >= bustAt) {
      const ttl = cached.settings.workerEnabled
        ? SETTINGS_CACHE_TTL_MS
        : Math.max(SETTINGS_CACHE_TTL_MS, 60000);
      if (now - cached.fetchedAt < ttl) {
        return cached.settings;
      }
    }

    const settings = await this.productionSettingsModel.get(req);
    this.settingsCache.set(userId, { settings, fetchedAt: now });
    return settings;
  }

  async _listTenants() {
    const mainPool = ServiceManager.getMainPool();
    return listGuidesEnabledTenants(mainPool);
  }
}

module.exports = { WorkerService, isWorkerEnabled };
