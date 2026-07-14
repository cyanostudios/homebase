// plugins/guides/production/SupervisorService.js
const { ProductionJobModel } = require('./ProductionJobModel');

const DEFAULT_TIMEOUT_MIN = Number(process.env.GUIDES_PRODUCTION_ITEM_TIMEOUT_MIN) || 10;
const DEFAULT_MAX_RETRIES = Number(process.env.GUIDES_PRODUCTION_MAX_RETRIES) || 5;

class SupervisorService {
  constructor(jobModel = new ProductionJobModel()) {
    this.jobModel = jobModel;
  }

  /**
   * Reset items stuck in processing beyond timeout.
   * @param {import('express').Request} req
   */
  async releaseStuckItems(req) {
    return this.jobModel.resetStuckItems(req, {
      timeoutMinutes: DEFAULT_TIMEOUT_MIN,
      maxRetries: DEFAULT_MAX_RETRIES,
    });
  }
}

module.exports = SupervisorService;
