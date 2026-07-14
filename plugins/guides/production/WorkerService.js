// plugins/guides/production/WorkerService.js
const os = require('os');
const { Logger } = require('@homebase/core');
const ServiceManager = require('../../../server/core/ServiceManager');
const SupervisorService = require('./SupervisorService');
const { createWorkerReq } = require('./workerContext');

const DEFAULT_POLL_MS = Number(process.env.GUIDES_PRODUCTION_WORKER_POLL_MS) || 5000;

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
   */
  constructor(productionOrchestration) {
    this.productionOrchestration = productionOrchestration;
    this.supervisor = new SupervisorService(productionOrchestration.jobModel);
    this.workerId = `${os.hostname()}-${process.pid}`;
    this.intervalId = null;
    this.tickInProgress = false;
  }

  start() {
    if (!isWorkerEnabled()) {
      Logger.info('Guides production worker disabled');
      return;
    }
    if (this.intervalId) return;

    Logger.info('Guides production worker starting', {
      workerId: this.workerId,
      pollMs: DEFAULT_POLL_MS,
    });

    this.intervalId = setInterval(() => {
      void this.tick();
    }, DEFAULT_POLL_MS);

    if (typeof this.intervalId.unref === 'function') {
      this.intervalId.unref();
    }

    void this.tick();
  }

  stop() {
    if (!this.intervalId) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
    Logger.info('Guides production worker stopped', { workerId: this.workerId });
  }

  async tick() {
    if (this.tickInProgress) return;
    this.tickInProgress = true;

    try {
      const tenants = await this._listTenants();
      const connectionPool = ServiceManager.get('connectionPool');

      for (const tenant of tenants) {
        const connectionString = tenant.connection_string || tenant.neon_connection_string;
        if (!connectionString) continue;

        const tenantPool = connectionPool.getTenantPool(connectionString);
        const req = createWorkerReq(tenantPool, tenant.user_id);

        try {
          await this.supervisor.releaseStuckItems(req);
          const itemsProcessed = await this.productionOrchestration.runWorkerTick(req);
          await this.productionOrchestration.jobModel.upsertWorkerHeartbeat(
            req,
            this.workerId,
            itemsProcessed,
          );
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

  async _listTenants() {
    const mainPool = ServiceManager.getMainPool();
    const tenantProvider = process.env.TENANT_PROVIDER || 'neon';
    const isLocalProvider = tenantProvider === 'local';

    if (isLocalProvider) {
      const usersResult = await mainPool.query(`
        SELECT id AS user_id, email
        FROM users
        ORDER BY id
      `);
      const mainConnectionString = process.env.DATABASE_URL;
      return usersResult.rows.map((user) => ({
        user_id: user.user_id,
        email: user.email,
        connection_string: `${mainConnectionString}?options=-csearch_path%3Dtenant_${user.user_id}`,
      }));
    }

    const result = await mainPool.query(`
      SELECT
        t.user_id,
        t.neon_connection_string AS connection_string,
        u.email
      FROM tenants t
      INNER JOIN users u ON t.user_id = u.id
      WHERE t.neon_connection_string IS NOT NULL
      ORDER BY t.user_id
    `);
    return result.rows;
  }
}

module.exports = { WorkerService, isWorkerEnabled };
