jest.mock('@homebase/core', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  Context: {
    getUserId: jest.fn(() => 1),
    hasPluginAccess: jest.fn(() => true),
  },
}));

jest.mock('../../../server/core/ServiceManager', () => ({
  getMainPool: jest.fn(() => ({})),
}));

const mockGetCategory = jest.fn().mockResolvedValue({ requestTypes: [] });
jest.mock('../../settings/model', () =>
  jest.fn().mockImplementation(() => ({
    getCategory: mockGetCategory,
  })),
);

const { Context } = require('@homebase/core');
const RequestController = require('../controller');
const garmentsAdapter = require('../pluginTargets/garments');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('RequestController.publicSubmit', () => {
  const prevPublicUserId = process.env.PUBLIC_REQUESTS_USER_ID;

  beforeEach(() => {
    process.env.PUBLIC_REQUESTS_USER_ID = '1';
  });

  afterAll(() => {
    if (prevPublicUserId === undefined) delete process.env.PUBLIC_REQUESTS_USER_ID;
    else process.env.PUBLIC_REQUESTS_USER_ID = prevPublicUserId;
  });

  it('returns only { success: true } and omits routing internals from the JSON body', async () => {
    const createdRow = {
      id: '42',
      title: 'Need kit',
      description: null,
      requestType: 'garments',
      status: 'not started',
      priority: 'Medium',
      teamId: null,
      assignedToIds: [],
      createdBy: null,
      createdAt: '2026-08-23T00:00:00.000Z',
      updatedAt: '2026-08-23T00:00:00.000Z',
      submitterName: 'Ada',
      submitterEmail: 'ada@example.com',
      pluginTarget: 'garments',
      pluginTargetId: '15',
      plugin_target_id: '15',
      targetListId: '15',
      pluginRoutedEntityId: null,
      pluginRoutedAt: null,
      extraData: { name: 'Ada', shirtSize: '152' },
    };
    const createPublic = jest.fn().mockResolvedValue(createdRow);
    const controller = new RequestController({ createPublic });
    const req = {
      publicRequestsPool: {},
      body: {
        title: 'Need kit',
        request_type: 'garments',
        submitter_name: 'Ada',
        submitter_email: 'ada@example.com',
      },
    };
    const res = mockRes();

    await controller.publicSubmit(req, res);

    expect(createPublic).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        user_id: 1,
        title: 'Need kit',
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/pluginTargetId/i);
    expect(serialized).not.toMatch(/plugin_target_id/i);
    expect(serialized).not.toMatch(/targetListId/i);
    expect(serialized).not.toMatch(/pluginTarget/i);
    expect(serialized).not.toMatch(/pluginRouted/i);
    expect(serialized).not.toMatch(/extraData/i);
    expect(res.body).not.toHaveProperty('request');
  });
});

describe('RequestController.sendToList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Context.hasPluginAccess.mockReturnValue(true);
  });

  it('creates person via garments adapter and marks request routed', async () => {
    const person = { id: '77', name: 'Ada' };
    const updated = {
      id: '9',
      status: 'completed',
      pluginRoutedEntityId: '77',
      pluginRoutedAt: '2026-08-23T00:00:00.000Z',
    };
    const model = {
      getById: jest.fn().mockResolvedValue({
        id: '9',
        pluginTarget: 'garments',
        pluginTargetId: '15',
        extraData: { name: 'Ada', shirtSize: '152' },
        pluginRoutedAt: null,
        pluginRoutedEntityId: null,
      }),
      markPluginRouted: jest.fn().mockResolvedValue(updated),
    };
    const spy = jest
      .spyOn(garmentsAdapter, 'createFromRequest')
      .mockResolvedValue({ person, entityId: '77' });

    const controller = new RequestController(model);
    const req = { params: { id: '9' }, session: { user: { role: 'member' } } };
    const res = mockRes();
    await controller.sendToList(req, res);

    expect(spy).toHaveBeenCalledWith(req, {
      targetListId: '15',
      extraData: { name: 'Ada', shirtSize: '152' },
      intakeSchema: null,
    });
    expect(model.markPluginRouted).toHaveBeenCalledWith(req, '9', { entityId: '77' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ request: updated, person });
    spy.mockRestore();
  });

  it('returns 409 when already routed', async () => {
    const controller = new RequestController({
      getById: jest.fn().mockResolvedValue({
        id: '9',
        pluginTarget: 'garments',
        pluginRoutedAt: '2026-01-01T00:00:00.000Z',
        pluginRoutedEntityId: '1',
      }),
    });
    const res = mockRes();
    await controller.sendToList({ params: { id: '9' }, session: { user: {} } }, res);
    expect(res.statusCode).toBe(409);
  });

  it('returns 403 when garments plugin is unavailable', async () => {
    Context.hasPluginAccess.mockReturnValue(false);
    const controller = new RequestController({
      getById: jest.fn().mockResolvedValue({
        id: '9',
        pluginTarget: 'garments',
        pluginTargetId: '15',
        extraData: { name: 'Ada' },
        pluginRoutedAt: null,
        pluginRoutedEntityId: null,
      }),
    });
    const res = mockRes();
    await controller.sendToList(
      { params: { id: '9' }, session: { user: { role: 'member' } } },
      res,
    );
    expect(res.statusCode).toBe(403);
  });
});
