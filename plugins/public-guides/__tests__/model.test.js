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

  test('transformPresentation exposes only public DTO fields', () => {
    expect(
      model.transformPresentation({
        id: 9,
        language: 'en',
        presentation_text: 'Hello',
        publication_status: 'published',
        approval_status: 'approved',
        staleness_status: 'fresh',
      }),
    ).toEqual({
      id: '9',
      language: 'en',
      presentationText: 'Hello',
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
    expect(() => __testOnly.parsePositiveInt('abc', 'presentationId')).toThrow(
      'Invalid presentationId',
    );
  });

  test('listPlaces applies optional language filter and public gate', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await model.listPlaces(pool, 1, 'sv');

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('guide_presentations gp');
    expect(sql).toContain('gp.language = $2');
    expect(sql).toContain("p.lifecycle_status = 'active'");
    expect(sql).toContain("gp.publication_status = 'published'");
    expect(sql).toContain("gp.approval_status = 'approved'");
    expect(sql).toContain("gp.staleness_status = 'fresh'");
    expect(sql).not.toContain('guide_audio');
    expect(sql).not.toContain('guide_stops');
    expect(sql).not.toContain('guide_variant_presentations');
    expect(params).toEqual([1, 'sv']);
  });

  test('listPlaces omits language filter when not provided', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await model.listPlaces(pool, 7, null);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toContain('gp.language =');
    expect(params).toEqual([7]);
  });

  test('listPresentations returns null when place is not public', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const result = await model.listPresentations(pool, 1, 42, null);
    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('listPresentations returns transformed presentations for a public place', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: 5,
              display_name: 'Museum',
              short_intro: null,
              geographic_reference: null,
              source_language: 'sv',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { id: 101, language: 'en', presentation_text: 'Welcome EN' },
            { id: 100, language: 'sv', presentation_text: 'Välkommen' },
          ],
        }),
    };

    const presentations = await model.listPresentations(pool, 1, 5, null);
    expect(presentations).toEqual([
      {
        id: '101',
        language: 'en',
        presentationText: 'Welcome EN',
      },
      {
        id: '100',
        language: 'sv',
        presentationText: 'Välkommen',
      },
    ]);

    const [presentationsSql] = pool.query.mock.calls[1];
    expect(presentationsSql).toContain(__testOnly.PUBLIC_PRESENTATION_WHERE.trim());
    expect(presentationsSql).toContain("gp.approval_status = 'approved'");
    expect(presentationsSql).not.toContain('guide_audio');
  });

  test('listPresentations applies language filter after public-place check', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: 5,
              display_name: 'Museum',
              short_intro: null,
              geographic_reference: null,
              source_language: 'sv',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }),
    };

    const presentations = await model.listPresentations(pool, 1, 5, 'en');
    expect(presentations).toEqual([]);

    const [sql, params] = pool.query.mock.calls[1];
    expect(params).toEqual([1, 5, 'en']);
    expect(sql).toContain('gp.language = $3');
  });

  test('getPlaceById returns null when no public presentation qualifies', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const result = await model.getPlaceById(pool, 1, 99);
    expect(result).toBeNull();
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain("gp.approval_status = 'approved'");
  });
});
