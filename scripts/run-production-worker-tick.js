#!/usr/bin/env node
/**
 * Run one guides production worker tick (for local E2E when worker is disabled in API process).
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local'), override: true });

const Bootstrap = require('../server/core/Bootstrap');
const GuidesModel = require('../plugins/guides/model');
const ProductionOrchestrationService = require('../plugins/guides/production/ProductionOrchestrationService');
const { WorkerService } = require('../plugins/guides/production/WorkerService');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing');
    process.exit(1);
  }
  Bootstrap.initializeServices();
  const model = new GuidesModel();
  const orchestration = new ProductionOrchestrationService(model);
  // Bypass tenant on/off so E2E / manual pump still processes the queue.
  const worker = new WorkerService(orchestration, undefined, { ignoreTenantSettings: true });
  await worker.tick();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
