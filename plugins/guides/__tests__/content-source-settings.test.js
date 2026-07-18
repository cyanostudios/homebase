// plugins/guides/__tests__/content-source-settings.test.js
jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  Database: { get: jest.fn() },
  Context: { getTenantUserId: jest.fn() },
}));

const { Context, Database } = require('@homebase/core');
const ContentSourceSettingsModel = require('../sources/ContentSourceSettingsModel');
const SourcePackService = require('../sources/SourcePackService');
const ContentSourceRegistry = require('../sources/ContentSourceRegistry');
const { _resetContentSourcesRegistrationForTests } = require('../sources/registerDefaultSources');

describe('ContentSourceSettingsModel', () => {
  beforeEach(() => {
    Context.getTenantUserId.mockReturnValue(7);
  });

  test('listEffective merges catalog defaults with DB overrides', async () => {
    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValue([{ source_key: 'unesco', enabled: true }]),
    });
    const model = new ContentSourceSettingsModel();
    const list = await model.listEffective({});

    const wiki = list.find((e) => e.key === 'wikipedia');
    const data = list.find((e) => e.key === 'wikidata');
    const unesco = list.find((e) => e.key === 'unesco');

    expect(wiki.enabled).toBe(true);
    expect(data.enabled).toBe(true);
    expect(unesco.enabledByDefault).toBe(false);
    expect(unesco.enabled).toBe(true);
  });

  test('getEnabledSourceKeys returns only enabled keys', async () => {
    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValue([
        { source_key: 'wikipedia', enabled: true },
        { source_key: 'wikidata', enabled: false },
      ]),
    });
    const model = new ContentSourceSettingsModel();
    await expect(model.getEnabledSourceKeys({})).resolves.toEqual(['wikipedia']);
  });

  test('setEnabled upserts and returns effective row', async () => {
    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValue([
        {
          id: 1,
          user_id: 7,
          source_key: 'unesco',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]),
    });
    const model = new ContentSourceSettingsModel();
    const result = await model.setEnabled({}, 'unesco', true);
    expect(result).toMatchObject({ key: 'unesco', enabled: true });
  });
});

describe('SourcePackService respects disabled keys', () => {
  afterEach(() => {
    _resetContentSourcesRegistrationForTests();
  });

  test('buildPack only queries requested sourceKeys', async () => {
    _resetContentSourcesRegistrationForTests();
    const wikiFetch = jest.fn().mockResolvedValue({
      sourceKey: 'wikipedia',
      status: 'ok',
      excerpts: [
        {
          sourceKey: 'wikipedia',
          title: 'A',
          url: 'https://example.com/a',
          excerpt: 'Alpha',
        },
      ],
    });
    const wikiDataFetch = jest.fn().mockResolvedValue({
      sourceKey: 'wikidata',
      status: 'ok',
      excerpts: [],
    });
    ContentSourceRegistry.register('wikipedia', () => ({ key: 'wikipedia', fetch: wikiFetch }));
    ContentSourceRegistry.register('wikidata', () => ({ key: 'wikidata', fetch: wikiDataFetch }));

    const service = new SourcePackService({
      registry: ContentSourceRegistry,
      sourceKeys: ['wikipedia', 'wikidata'],
    });
    const pack = await service.buildPack({ displayName: 'Place' }, { sourceKeys: ['wikipedia'] });

    expect(wikiFetch).toHaveBeenCalled();
    expect(wikiDataFetch).not.toHaveBeenCalled();
    expect(pack.sources).toHaveLength(1);
  });
});
