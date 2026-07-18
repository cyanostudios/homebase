// plugins/guides/__tests__/source-pack.test.js
jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  Database: { get: jest.fn() },
}));

const {
  listContentSourceCatalog,
  DEFAULT_CONTENT_SOURCES,
} = require('../sources/contentSourceCatalog');
const ContentSourceRegistry = require('../sources/ContentSourceRegistry');
const {
  ensureContentSourcesRegistered,
  _resetContentSourcesRegistrationForTests,
} = require('../sources/registerDefaultSources');
const SourcePackService = require('../sources/SourcePackService');
const WikipediaContentSource = require('../sources/adapters/WikipediaContentSource');
const { normalizeUnescoList, matchesPlace } = require('../sources/adapters/UnescoContentSource');

describe('content source catalog', () => {
  test('lists wikipedia and unesco by default', () => {
    expect(DEFAULT_CONTENT_SOURCES).toEqual(['wikipedia', 'unesco']);
    const list = listContentSourceCatalog();
    expect(list.map((e) => e.key).sort()).toEqual(['unesco', 'wikipedia']);
  });
});

describe('ContentSourceRegistry', () => {
  afterEach(() => {
    _resetContentSourcesRegistrationForTests();
  });

  test('registers default adapters', () => {
    ensureContentSourcesRegistered();
    expect(ContentSourceRegistry.has('wikipedia')).toBe(true);
    expect(ContentSourceRegistry.has('unesco')).toBe(true);
    expect(ContentSourceRegistry.create('wikipedia').key).toBe('wikipedia');
  });
});

describe('WikipediaContentSource', () => {
  test('returns excerpts from geosearch + extracts', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ query: { geosearch: [{ pageid: 1 }] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: {
            pages: {
              1: {
                pageid: 1,
                title: 'Test Place',
                extract: 'A historic site.',
                fullurl: 'https://en.wikipedia.org/wiki/Test_Place',
              },
            },
          },
        }),
      });

    const source = new WikipediaContentSource({ fetchFn });
    const result = await source.fetch({
      displayName: 'Test Place',
      coordinates: { lat: 59.3, lng: 18.0 },
      language: 'en',
    });

    expect(result.status).toBe('ok');
    expect(result.excerpts).toHaveLength(1);
    expect(result.excerpts[0].title).toBe('Test Place');
    expect(result.excerpts[0].sourceKey).toBe('wikipedia');
  });
});

describe('Unesco helpers', () => {
  test('normalizeUnescoList maps WHC rows', () => {
    const sites = normalizeUnescoList([
      {
        id_no: 555,
        name_en: 'Birka and Hovgården',
        short_description_en: 'Viking sites',
        states_name_en: 'Sweden',
        iso_code: 'SE',
      },
    ]);
    expect(sites[0].name).toBe('Birka and Hovgården');
    expect(matchesPlace(sites[0], 'birka', 'SE')).toBe(true);
  });
});

describe('SourcePackService', () => {
  afterEach(() => {
    _resetContentSourcesRegistrationForTests();
  });

  test('builds combined pack from adapters', async () => {
    _resetContentSourcesRegistrationForTests();
    ContentSourceRegistry.register('wikipedia', () => ({
      key: 'wikipedia',
      fetch: async () => ({
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
        attribution: null,
      }),
    }));
    ContentSourceRegistry.register('unesco', () => ({
      key: 'unesco',
      fetch: async () => ({
        sourceKey: 'unesco',
        status: 'empty',
        excerpts: [],
        attribution: null,
      }),
    }));
    // Prevent ensureContentSourcesRegistered from treating registry as uninitialized
    ensureContentSourcesRegistered();

    const service = new SourcePackService({
      registry: ContentSourceRegistry,
      sourceKeys: ['wikipedia', 'unesco'],
    });
    const pack = await service.buildPack({ displayName: 'Place' });

    expect(pack.excerpts).toHaveLength(1);
    expect(pack.combinedText).toContain('Alpha');
    expect(pack.sources.map((s) => s.status)).toEqual(['ok', 'empty']);
  });
});
