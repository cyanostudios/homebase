jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const { ConnectionTestRegistry } = require('../ConnectionTestRegistry');
const AIProvidersController = require('../controller');

describe('AIProvidersController', () => {
  let model;
  let registry;
  let controller;
  let res;

  beforeEach(() => {
    model = {
      getSettings: jest.fn(),
      listConfiguredSettings: jest.fn(),
      listCatalog: jest.fn(),
      listRouting: jest.fn(),
      saveRouting: jest.fn(),
      deletePluginRouting: jest.fn(),
      deleteSettings: jest.fn(),
    };
    registry = new ConnectionTestRegistry();
    controller = new AIProvidersController(model, { connectionTestRegistry: registry });
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  test('getSettings returns configured providers', async () => {
    model.listConfiguredSettings.mockResolvedValue([{ providerKey: 'openai', enabled: true }]);

    await controller.getSettings({}, res);

    expect(model.listConfiguredSettings).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      providers: [{ providerKey: 'openai', enabled: true }],
    });
  });

  test('getCatalog returns provider catalog', async () => {
    model.listCatalog.mockReturnValue([
      { providerKey: 'openai', defaultModel: 'gpt-4o-mini' },
      { providerKey: 'anthropic', defaultModel: 'claude-sonnet-4-5' },
    ]);

    await controller.getCatalog({}, res);

    expect(res.json).toHaveBeenCalledWith({
      providers: [
        { providerKey: 'openai', defaultModel: 'gpt-4o-mini' },
        { providerKey: 'anthropic', defaultModel: 'claude-sonnet-4-5' },
      ],
    });
  });

  test('getRouting returns routing configuration', async () => {
    model.listRouting.mockResolvedValue({
      global: { providerKey: 'openai', model: 'gpt-4o-mini' },
      plugins: [{ pluginKey: 'guides', label: 'Guides', providerKey: null, model: null }],
      routablePlugins: [{ key: 'guides', label: 'Guides' }],
    });

    await controller.getRouting({}, res);

    expect(model.listRouting).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      global: { providerKey: 'openai', model: 'gpt-4o-mini' },
      plugins: [{ pluginKey: 'guides', label: 'Guides', providerKey: null, model: null }],
      routablePlugins: [{ key: 'guides', label: 'Guides' }],
    });
  });

  test('saveGlobalRouting saves global default', async () => {
    model.saveRouting.mockResolvedValue({
      global: { providerKey: 'openai', model: 'gpt-4o-mini' },
    });

    const req = { body: { providerKey: 'openai', model: 'gpt-4o-mini' } };
    await controller.saveGlobalRouting(req, res);

    expect(model.saveRouting).toHaveBeenCalledWith(req, '*', req.body);
    expect(res.json).toHaveBeenCalledWith({
      global: { providerKey: 'openai', model: 'gpt-4o-mini' },
    });
  });

  test('savePluginRouting saves plugin override', async () => {
    model.saveRouting.mockResolvedValue({
      plugin: { pluginKey: 'guides', providerKey: 'anthropic', model: 'claude-sonnet-4-5' },
    });

    const req = {
      params: { pluginKey: 'guides' },
      body: { providerKey: 'anthropic', model: 'claude-sonnet-4-5' },
    };
    await controller.savePluginRouting(req, res);

    expect(model.saveRouting).toHaveBeenCalledWith(req, 'guides', req.body);
    expect(res.json).toHaveBeenCalledWith({
      plugin: { pluginKey: 'guides', providerKey: 'anthropic', model: 'claude-sonnet-4-5' },
    });
  });

  test('deletePluginRouting removes plugin override', async () => {
    model.deletePluginRouting.mockResolvedValue({ pluginKey: 'guides', deleted: true });

    const req = { params: { pluginKey: 'guides' } };
    await controller.deletePluginRouting(req, res);

    expect(model.deletePluginRouting).toHaveBeenCalledWith(req, 'guides');
    expect(res.json).toHaveBeenCalledWith({ pluginKey: 'guides', deleted: true });
  });

  test('deleteSettings removes provider configuration', async () => {
    model.deleteSettings.mockResolvedValue({ providerKey: 'openai', deleted: true });

    const req = { params: { providerKey: 'openai' } };
    await controller.deleteSettings(req, res);

    expect(model.deleteSettings).toHaveBeenCalledWith(req, 'openai');
    expect(res.json).toHaveBeenCalledWith({ providerKey: 'openai', deleted: true });
  });
});

describe('AIProvidersController.testSettings', () => {
  let model;
  let registry;
  let controller;
  let res;

  beforeEach(() => {
    model = {
      getSettings: jest.fn(),
    };
    registry = new ConnectionTestRegistry();
    controller = new AIProvidersController(model, { connectionTestRegistry: registry });
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  test('uses connection test registry instead of a concrete adapter', async () => {
    const testConnection = jest.fn().mockResolvedValue({ ok: true, model: 'gpt-4o-mini' });
    registry.register('openai', () => ({ testConnection }));

    const req = {
      params: { providerKey: 'openai' },
      body: { apiKey: 'sk-test', defaultModel: 'gpt-4o-mini' },
    };

    await controller.testSettings(req, res);

    expect(testConnection).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
    });
  });

  test('returns 400 when API key missing', async () => {
    const req = {
      params: { providerKey: 'openai' },
      body: {},
    };

    await controller.testSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'API key is required to test connection',
    });
  });

  test('returns 400 when tester not registered', async () => {
    const req = {
      params: { providerKey: 'openai' },
      body: { apiKey: 'sk-test' },
    };

    await controller.testSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Connection test not available for this provider',
    });
  });
});
