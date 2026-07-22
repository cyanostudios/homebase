jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  Context: { getTenantUserId: jest.fn() },
  Database: { get: jest.fn() },
}));

const { Context, Database } = require('@homebase/core');
const { AIProviderSettingsModel, getProviderDefaultModel } = require('../model');

const OPENAI_DEFAULT_MODEL = getProviderDefaultModel('openai');

describe('AIProviderSettingsModel', () => {
  let model;
  let db;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new AIProviderSettingsModel();
    db = { query: jest.fn() };
    Context.getTenantUserId.mockReturnValue(7);
    Database.get.mockReturnValue(db);
  });

  test('getSettings masks stored api key', async () => {
    db.query.mockResolvedValue([
      {
        id: 1,
        user_id: 7,
        provider_key: 'openai',
        enabled: true,
        api_key: 'sk-test',
        default_model: 'gpt-4.1-mini',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ]);

    const result = await model.getSettings({}, 'openai');

    expect(result).toEqual(
      expect.objectContaining({
        providerKey: 'openai',
        enabled: true,
        apiKey: '••••••••',
        hasApiKey: true,
        defaultModel: 'gpt-4.1-mini',
      }),
    );
  });

  test('getSettings returns disabled default when row missing', async () => {
    db.query.mockResolvedValue([]);

    const result = await model.getSettings({}, 'openai');

    expect(result).toEqual(
      expect.objectContaining({
        userId: '7',
        providerKey: 'openai',
        enabled: false,
        hasApiKey: false,
        defaultModel: OPENAI_DEFAULT_MODEL,
      }),
    );
  });

  test('saveSettings preserves stored masked api key', async () => {
    db.query.mockResolvedValueOnce([{ id: 1, api_key: 'sk-stored' }]).mockResolvedValueOnce([
      {
        id: 1,
        user_id: 7,
        provider_key: 'openai',
        enabled: true,
        api_key: 'sk-stored',
        default_model: 'gpt-4o-mini',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ]);

    await model.saveSettings({}, 'openai', {
      enabled: true,
      apiKey: '••••••••',
      defaultModel: 'gpt-4o-mini',
    });

    expect(db.query.mock.calls[1][1][3]).toBe('sk-stored');
  });

  test('saveSettings partial update preserves enabled and defaultModel', async () => {
    db.query
      .mockResolvedValueOnce([
        {
          id: 1,
          api_key: 'sk-old',
          enabled: true,
          default_model: 'gpt-4.1-mini',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          user_id: 7,
          provider_key: 'openai',
          enabled: true,
          api_key: 'sk-new',
          default_model: 'gpt-4.1-mini',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ]);

    await model.saveSettings({}, 'openai', { apiKey: 'sk-new' });

    const upsertParams = db.query.mock.calls[1][1];
    expect(upsertParams[2]).toBe(true);
    expect(upsertParams[3]).toBe('sk-new');
    expect(upsertParams[4]).toBe('gpt-4.1-mini');
  });

  test('saveSettings new row with only apiKey uses defaults for enabled and model', async () => {
    db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 1,
        user_id: 7,
        provider_key: 'openai',
        enabled: false,
        api_key: 'sk-new',
        default_model: OPENAI_DEFAULT_MODEL,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ]);

    await model.saveSettings({}, 'openai', { apiKey: 'sk-new' });

    const upsertParams = db.query.mock.calls[1][1];
    expect(upsertParams[2]).toBe(false);
    expect(upsertParams[4]).toBe(OPENAI_DEFAULT_MODEL);
  });

  test('getResolvedProviderConfig returns null when disabled', async () => {
    jest.spyOn(model, 'getSettings').mockResolvedValue({
      providerKey: 'openai',
      enabled: false,
      apiKeyRaw: 'sk-test',
      defaultModel: 'gpt-4o-mini',
    });

    const result = await model.getResolvedProviderConfig({}, 'openai');

    expect(result).toBeNull();
  });

  test('resolveRuntimeConfig prefers DB over env', async () => {
    jest.spyOn(model, 'getResolvedProviderConfig').mockResolvedValue({
      providerKey: 'openai',
      enabled: true,
      apiKey: 'sk-db',
      defaultModel: 'gpt-4.1-mini',
    });

    const result = await model.resolveRuntimeConfig({}, 'openai');

    expect(result).toEqual({
      providerKey: 'openai',
      apiKey: 'sk-db',
      defaultModel: 'gpt-4.1-mini',
      voiceId: null,
    });
  });

  test('resolveRuntimeConfig falls back to env via catalog', async () => {
    jest.spyOn(model, 'getResolvedProviderConfig').mockResolvedValue(null);
    const previousApiKey = process.env.OPENAI_API_KEY;
    const previousModel = process.env.GUIDES_TEXT_OPENAI_MODEL;
    process.env.OPENAI_API_KEY = 'sk-env';
    process.env.GUIDES_TEXT_OPENAI_MODEL = 'gpt-env';

    try {
      const result = await model.resolveRuntimeConfig({}, 'openai');
      expect(result).toEqual({
        providerKey: 'openai',
        apiKey: 'sk-env',
        defaultModel: 'gpt-env',
        voiceId: null,
      });
    } finally {
      process.env.OPENAI_API_KEY = previousApiKey;
      process.env.GUIDES_TEXT_OPENAI_MODEL = previousModel;
    }
  });

  test('getPreferredEnabledProviderKey returns first enabled DB provider', async () => {
    jest.spyOn(model, 'getResolvedProviderConfig').mockResolvedValue({
      providerKey: 'openai',
      apiKey: 'sk',
      defaultModel: 'gpt-4o-mini',
    });

    await expect(model.getPreferredEnabledProviderKey({})).resolves.toBe('openai');
  });

  test('getPreferredEnabledProviderKey returns null when none enabled', async () => {
    jest.spyOn(model, 'getResolvedProviderConfig').mockResolvedValue(null);

    await expect(model.getPreferredEnabledProviderKey({})).resolves.toBeNull();
  });

  test('listConfiguredSettings returns persisted rows only', async () => {
    db.query.mockResolvedValue([
      {
        id: 1,
        user_id: 7,
        provider_key: 'openai',
        enabled: true,
        api_key: 'sk-test',
        default_model: 'gpt-4o-mini',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ]);

    const result = await model.listConfiguredSettings({});

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        providerKey: 'openai',
        enabled: true,
        hasApiKey: true,
      }),
    );
  });

  test('listCatalog returns all catalog providers', () => {
    const result = model.listCatalog();
    const keys = result.map((entry) => entry.providerKey);

    expect(keys).toEqual([
      'openai',
      'anthropic',
      'google',
      'xai',
      'mistral',
      'cohere',
      'deepseek',
      'openrouter',
      'azure-openai',
      'elevenlabs',
    ]);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerKey: 'openai',
          defaultModel: OPENAI_DEFAULT_MODEL,
          textGenerationCapable: true,
          audioGenerationCapable: false,
          models: expect.arrayContaining([
            expect.objectContaining({ id: 'gpt-4o-mini', label: 'GPT-4o mini' }),
          ]),
        }),
        expect.objectContaining({
          providerKey: 'anthropic',
          defaultModel: 'claude-sonnet-4-5',
          textGenerationCapable: false,
          audioGenerationCapable: false,
          models: expect.arrayContaining([
            expect.objectContaining({ id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' }),
            expect.objectContaining({ id: 'claude-opus-4-5' }),
          ]),
        }),
        expect.objectContaining({
          providerKey: 'azure-openai',
          defaultModel: 'gpt-4o-mini',
          models: expect.any(Array),
        }),
        expect.objectContaining({
          providerKey: 'elevenlabs',
          defaultModel: 'eleven_multilingual_v2',
          textGenerationCapable: false,
          audioGenerationCapable: true,
          models: expect.arrayContaining([
            expect.objectContaining({
              id: 'eleven_multilingual_v2',
              label: 'Eleven Multilingual v2',
            }),
          ]),
        }),
      ]),
    );
    expect(result.every((entry) => Array.isArray(entry.models) && entry.models.length > 0)).toBe(
      true,
    );
  });

  test('normalizeProviderKey accepts catalog providers and rejects unknown', () => {
    const { normalizeProviderKey } = require('../model');
    expect(normalizeProviderKey('Anthropic')).toBe('anthropic');
    expect(normalizeProviderKey('azure-openai')).toBe('azure-openai');
    expect(() => normalizeProviderKey('unknown-vendor')).toThrow('Unsupported AI provider');
  });

  test('deleteSettings removes row for tenant user', async () => {
    db.query.mockResolvedValue([]);

    const result = await model.deleteSettings({}, 'openai');

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM'), [7, 'openai']);
    expect(result).toEqual({ providerKey: 'openai', deleted: true });
  });

  test('listRouting returns global and plugin assignments', async () => {
    db.query.mockResolvedValue([
      {
        id: 1,
        user_id: 7,
        scope: '*',
        provider_key: 'openai',
        model: 'gpt-4o-mini',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 2,
        user_id: 7,
        scope: 'guides',
        provider_key: 'anthropic',
        model: 'claude-sonnet-4-5',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ]);

    const result = await model.listRouting({});

    expect(result.global).toEqual({ providerKey: 'openai', model: 'gpt-4o-mini' });
    expect(result.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginKey: 'guides',
          providerKey: 'anthropic',
          model: 'claude-sonnet-4-5',
        }),
        expect.objectContaining({
          pluginKey: 'guides-audio',
          label: 'Guides (audio)',
          providerKey: null,
          model: null,
        }),
      ]),
    );
    expect(result.routablePlugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'guides' }),
        expect.objectContaining({ key: 'guides-audio' }),
      ]),
    );
  });

  test('saveRouting rejects non-generatable provider for guides and global', async () => {
    Context.getTenantUserId.mockReturnValue(7);
    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValue([
        {
          id: 1,
          user_id: 7,
          provider_key: 'anthropic',
          enabled: true,
          api_key: 'sk-ant',
          default_model: 'claude-sonnet-4-5',
        },
      ]),
    });

    await expect(
      model.saveRouting({}, 'guides', { providerKey: 'anthropic', model: 'claude-sonnet-4-5' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'provider_not_generation_capable',
    });

    await expect(
      model.saveRouting({}, '*', { providerKey: 'anthropic', model: 'claude-sonnet-4-5' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'provider_not_generation_capable',
    });
  });

  test('saveRouting rejects non-audio-capable provider for guides-audio', async () => {
    Context.getTenantUserId.mockReturnValue(7);
    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValue([
        {
          id: 1,
          user_id: 7,
          provider_key: 'openai',
          enabled: true,
          api_key: 'sk-test',
          default_model: 'gpt-4o-mini',
        },
      ]),
    });

    await expect(
      model.saveRouting({}, 'guides-audio', { providerKey: 'openai', model: 'gpt-4o-mini' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'provider_not_generation_capable',
    });
  });

  test('saveRouting requires configured enabled provider', async () => {
    jest.spyOn(model, 'getResolvedProviderConfig').mockResolvedValue(null);

    await expect(
      model.saveRouting({}, '*', { providerKey: 'openai', model: 'gpt-4o-mini' }),
    ).rejects.toThrow('Selected provider is not configured and enabled');
  });

  test('saveRouting upserts global default', async () => {
    jest.spyOn(model, 'getResolvedProviderConfig').mockResolvedValue({
      providerKey: 'openai',
      enabled: true,
      apiKey: 'sk-test',
      defaultModel: 'gpt-4o-mini',
    });
    db.query.mockResolvedValue([
      {
        id: 1,
        user_id: 7,
        scope: '*',
        provider_key: 'openai',
        model: 'gpt-4o',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ]);

    const result = await model.saveRouting({}, '*', {
      providerKey: 'openai',
      model: 'gpt-4o',
    });

    expect(result.global).toEqual({ providerKey: 'openai', model: 'gpt-4o' });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_provider_routing'),
      [7, '*', 'openai', 'gpt-4o'],
    );
  });

  test('deletePluginRouting removes plugin override', async () => {
    db.query.mockResolvedValue([]);

    const result = await model.deletePluginRouting({}, 'guides');

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM'), [7, 'guides']);
    expect(result).toEqual({ pluginKey: 'guides', deleted: true });
  });
});
