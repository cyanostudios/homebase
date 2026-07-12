// plugins/public-guides/__tests__/model.test.js
jest.mock('@homebase/core', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const PublicGuidesModel = require('../model');
const { __testOnly } = require('../model');

describe('PublicGuidesModel', () => {
  let model;

  beforeEach(() => {
    model = new PublicGuidesModel();
  });

  test('transformPlace exposes only public DTO fields', () => {
    expect(
      model.transformPlace({
        id: 3,
        display_name: 'Museum',
        short_intro: 'Welcome',
        geographic_reference: 'Stockholm',
        source_language: 'sv',
        lifecycle_status: 'active',
        canonical_narrative: 'secret',
      }),
    ).toEqual({
      id: '3',
      displayName: 'Museum',
      shortIntro: 'Welcome',
      geographicReference: 'Stockholm',
      sourceLanguage: 'sv',
    });
  });

  test('transformVariant sets hasAudio true and omits internal fields', () => {
    expect(
      model.transformVariant({
        id: 9,
        variant_type: 'quick',
        language: 'en',
        presentation_text: 'Hello',
        publication_status: 'published',
        storage_ref: 'local:file.wav',
      }),
    ).toEqual({
      id: '9',
      variantType: 'quick',
      language: 'en',
      presentationText: 'Hello',
      hasAudio: true,
    });
  });

  test('parseOptionalLanguageQuery returns null for empty values', () => {
    expect(__testOnly.parseOptionalLanguageQuery(undefined)).toBeNull();
    expect(__testOnly.parseOptionalLanguageQuery('')).toBeNull();
    expect(__testOnly.parseOptionalLanguageQuery('  ')).toBeNull();
  });

  test('parseOptionalLanguageQuery normalizes language codes', () => {
    expect(__testOnly.parseOptionalLanguageQuery('SV')).toBe('sv');
    expect(__testOnly.parseOptionalLanguageQuery('en-us')).toBe('en-us');
  });

  test('parsePositiveInt rejects invalid ids', () => {
    expect(() => __testOnly.parsePositiveInt('0', 'placeId')).toThrow('Invalid placeId');
    expect(() => __testOnly.parsePositiveInt('abc', 'stopId')).toThrow('Invalid stopId');
  });

  test('listPlaces applies optional language filter', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await model.listPlaces(pool, 1, 'sv');

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('gvp.language = $2');
    expect(sql).toContain("p.lifecycle_status = 'active'");
    expect(sql).toContain("gvp.publication_status = 'published'");
    expect(sql).toContain("gvp.staleness_status = 'fresh'");
    expect(sql).toContain("ga.status = 'ready'");
    expect(params).toEqual([1, 'sv']);
  });

  test('listPlaces omits language filter when not provided', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await model.listPlaces(pool, 7, null);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toContain('gvp.language =');
    expect(params).toEqual([7]);
  });

  test('listStopsWithVariants returns null when place has no public stops', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const result = await model.listStopsWithVariants(pool, 1, 42, null);
    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('listStopsWithVariants groups variants under stops', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            { id: 10, title: 'Entrance', sequence_order: 1 },
            { id: 11, title: 'Hall', sequence_order: 2 },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 101,
              stop_id: 10,
              variant_type: 'normal',
              language: 'sv',
              presentation_text: 'Welcome',
              sequence_order: 1,
            },
            {
              id: 102,
              stop_id: 11,
              variant_type: 'quick',
              language: 'sv',
              presentation_text: 'Hall text',
              sequence_order: 2,
            },
          ],
        }),
    };

    const stops = await model.listStopsWithVariants(pool, 1, 5, null);
    expect(stops).toEqual([
      {
        id: '10',
        title: 'Entrance',
        sequenceOrder: 1,
        variants: [
          {
            id: '101',
            variantType: 'normal',
            language: 'sv',
            presentationText: 'Welcome',
            hasAudio: true,
          },
        ],
      },
      {
        id: '11',
        title: 'Hall',
        sequenceOrder: 2,
        variants: [
          {
            id: '102',
            variantType: 'quick',
            language: 'sv',
            presentationText: 'Hall text',
            hasAudio: true,
          },
        ],
      },
    ]);
  });

  test('getReadyAudioForPublicVariant returns null without storage_ref', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({
        rows: [{ storage_ref: null, mime_type: 'audio/wav' }],
      }),
    };

    const result = await model.getReadyAudioForPublicVariant(pool, 1, 2, 3, 4);
    expect(result).toBeNull();
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain(__testOnly.PUBLIC_VARIANT_WHERE.trim());
    expect(sql).toContain('gvp.id = $4');
  });

  test('getReadyAudioForPublicVariant returns stream metadata when qualified', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({
        rows: [{ storage_ref: 'local:audio.wav', mime_type: 'audio/wav' }],
      }),
    };

    const result = await model.getReadyAudioForPublicVariant(pool, 1, 2, 3, 4);
    expect(result).toEqual({
      storageRef: 'local:audio.wav',
      mimeType: 'audio/wav',
    });
  });
});
