// plugins/guides/__tests__/supervisor.test.js
jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  Database: { get: jest.fn() },
}));

const SupervisorService = require('../production/SupervisorService');

describe('SupervisorService', () => {
  test('releaseStuckItems delegates to job model', async () => {
    const jobModel = {
      resetStuckItems: jest.fn().mockResolvedValue({ retried: 2, failed: 1 }),
    };
    const supervisor = new SupervisorService(jobModel);

    const result = await supervisor.releaseStuckItems({});

    expect(jobModel.resetStuckItems).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        timeoutMinutes: expect.any(Number),
        maxRetries: expect.any(Number),
      }),
    );
    expect(result).toEqual({ retried: 2, failed: 1 });
  });
});
