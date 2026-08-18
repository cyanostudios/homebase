// plugins/guides/__tests__/worker-service.test.js
jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  Context: { getTenantUserId: jest.fn(), getUserId: jest.fn() },
}));

jest.mock('../../../server/core/ServiceManager', () => ({
  get: jest.fn(),
  getMainPool: jest.fn(),
}));

jest.mock('../production/listGuidesEnabledTenants', () => ({
  listGuidesEnabledTenants: jest.fn(),
}));

jest.mock('../production/productionSettingsCache', () => ({
  getProductionSettingsBustAt: jest.fn(() => 0),
  bustProductionSettingsCache: jest.fn(),
}));

const { Logger, Context } = require('@homebase/core');
const ServiceManager = require('../../../server/core/ServiceManager');
const { listGuidesEnabledTenants } = require('../production/listGuidesEnabledTenants');
const { bustProductionSettingsCache } = require('../production/productionSettingsCache');
const { WorkerService } = require('../production/WorkerService');
const GuidesController = require('../controller');

async function waitForIdle(worker) {
  await Promise.resolve();
  while (worker.tickInProgress) {
    await Promise.resolve();
  }
}

describe('WorkerService park/wake', () => {
  let connectionPool;
  let settingsModel;
  let orchestration;
  const tenant = { user_id: 2, connection_string: 'postgres://tenant/db' };

  beforeEach(() => {
    process.env.GUIDES_PRODUCTION_WORKER_ENABLED = 'true';
    jest.useFakeTimers();
    jest.clearAllMocks();

    connectionPool = { getTenantPool: jest.fn(() => ({ query: jest.fn() })) };
    ServiceManager.get.mockImplementation((name) => {
      if (name === 'connectionPool') return connectionPool;
      return null;
    });
    ServiceManager.getMainPool.mockReturnValue({});
    listGuidesEnabledTenants.mockResolvedValue([tenant]);

    settingsModel = {
      get: jest.fn().mockResolvedValue({ workerEnabled: false, pollIntervalMs: 5000 }),
    };
    orchestration = {
      jobModel: {
        upsertWorkerHeartbeat: jest.fn().mockResolvedValue(undefined),
        resetStuckItems: jest.fn().mockResolvedValue({ retried: 0, failed: 0 }),
      },
      runWorkerTick: jest.fn().mockResolvedValue(0),
    };
  });

  afterEach(() => {
    delete process.env.GUIDES_PRODUCTION_WORKER_ENABLED;
    jest.useRealTimers();
  });

  test('start parks the loop when the tenant worker is off', async () => {
    const worker = new WorkerService(orchestration, settingsModel);
    worker.start();
    await waitForIdle(worker);

    expect(worker.intervalId).toBeNull();
    expect(worker.parked).toBe(true);
    expect(orchestration.runWorkerTick).not.toHaveBeenCalled();
    expect(Logger.info).toHaveBeenCalledWith(
      'Guides production worker parked',
      expect.objectContaining({ workerId: worker.workerId }),
    );

    listGuidesEnabledTenants.mockClear();
    jest.advanceTimersByTime(30_000);
    await waitForIdle(worker);
    expect(listGuidesEnabledTenants).not.toHaveBeenCalled();
  });

  test('does not open a tenant pool on a later tick when worker is cached off', async () => {
    const worker = new WorkerService(orchestration, settingsModel);
    await worker.tick();

    expect(connectionPool.getTenantPool).toHaveBeenCalledTimes(1);
    expect(settingsModel.get).toHaveBeenCalledTimes(1);

    connectionPool.getTenantPool.mockClear();
    settingsModel.get.mockClear();
    listGuidesEnabledTenants.mockClear();

    await worker.tick();
    expect(settingsModel.get).not.toHaveBeenCalled();
    expect(connectionPool.getTenantPool).not.toHaveBeenCalled();
    expect(listGuidesEnabledTenants).toHaveBeenCalledTimes(1);
  });

  test('notifySettingsChanged(true) wakes polling and processes jobs', async () => {
    const worker = new WorkerService(orchestration, settingsModel);
    await worker.tick();
    expect(worker.intervalId).toBeNull();
    expect(orchestration.runWorkerTick).not.toHaveBeenCalled();
    connectionPool.getTenantPool.mockClear();

    worker.notifySettingsChanged(2, { workerEnabled: true, pollIntervalMs: 5000 });
    await waitForIdle(worker);

    expect(worker.intervalId).not.toBeNull();
    expect(worker.parked).toBe(false);
    expect(orchestration.runWorkerTick).toHaveBeenCalledTimes(1);
    worker.stop();
  });

  test('notifySettingsChanged(false) parks when it was the last enabled tenant', async () => {
    settingsModel.get.mockResolvedValue({ workerEnabled: true, pollIntervalMs: 5000 });
    const worker = new WorkerService(orchestration, settingsModel);
    worker.start();
    await waitForIdle(worker);
    expect(worker.intervalId).not.toBeNull();

    worker.notifySettingsChanged(2, { workerEnabled: false, pollIntervalMs: 5000 });
    await waitForIdle(worker);

    expect(worker.intervalId).toBeNull();
    expect(worker.parked).toBe(true);
    worker.stop();
  });

  test('processes only tenants with workerEnabled', async () => {
    listGuidesEnabledTenants.mockResolvedValue([
      tenant,
      { user_id: 9, connection_string: 'postgres://tenant-b/db' },
    ]);
    settingsModel.get.mockImplementation((req) => {
      const id = req.session.currentTenantUserId;
      return Promise.resolve({
        workerEnabled: id === 9,
        pollIntervalMs: 5000,
      });
    });
    const worker = new WorkerService(orchestration, settingsModel);
    await worker.tick();

    expect(orchestration.runWorkerTick).toHaveBeenCalledTimes(1);
    const req = orchestration.runWorkerTick.mock.calls[0][0];
    expect(req.session.currentTenantUserId).toBe(9);
    worker.stop();
  });

  test('ignoreTenantSettings does not park when no tenant settings row', async () => {
    const worker = new WorkerService(orchestration, settingsModel, {
      ignoreTenantSettings: true,
    });
    worker.start();
    await waitForIdle(worker);

    expect(worker.intervalId).not.toBeNull();
    expect(orchestration.runWorkerTick).toHaveBeenCalled();
    expect(settingsModel.get).not.toHaveBeenCalled();
    worker.stop();
  });

  test('start is a no-op in test env without GUIDES_PRODUCTION_WORKER_ENABLED', async () => {
    delete process.env.GUIDES_PRODUCTION_WORKER_ENABLED;
    const worker = new WorkerService(orchestration, settingsModel);
    worker.start();
    await waitForIdle(worker);
    expect(worker.intervalId).toBeNull();
    expect(listGuidesEnabledTenants).not.toHaveBeenCalled();
    expect(Logger.info).toHaveBeenCalledWith('Guides production worker disabled');
  });
});

describe('GuidesController production settings notify', () => {
  test('updateProductionSettings busts cache and notifies the worker', async () => {
    const settings = { workerEnabled: true, pollIntervalMs: 15000 };
    const productionSettingsModel = {
      constructor: { getAllowedPollIntervalsMs: () => [5000, 15000] },
      upsert: jest.fn().mockResolvedValue(settings),
    };
    const productionWorker = { notifySettingsChanged: jest.fn() };
    const controller = new GuidesController(
      null,
      null,
      null,
      null,
      null,
      productionSettingsModel,
      productionWorker,
    );
    Context.getTenantUserId.mockReturnValue(2);
    const res = { json: jest.fn() };

    await controller.updateProductionSettings({ body: { workerEnabled: true } }, res);

    expect(bustProductionSettingsCache).toHaveBeenCalledWith(2);
    expect(productionWorker.notifySettingsChanged).toHaveBeenCalledWith(2, settings);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ workerEnabled: true, pollIntervalMs: 15000 }),
    );
  });
});
