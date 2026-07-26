const {
  slugify,
  districtToSlug,
  districtPath,
  districtSlugFromPath,
  resolveDistrictFromSlug,
  cupDetailUrl,
  collectDistricts,
  ensureDistrictOption,
} = require('../lib/districtUrls');

describe('Cupappen districtUrls', () => {
  test('slugify transliterates Swedish characters', () => {
    expect(slugify('Skåne')).toBe('skane');
    expect(slugify('Övrigt')).toBe('ovrigt');
  });

  test('districtSlugFromPath accepts single district segment only', () => {
    expect(districtSlugFromPath('/skane/')).toBe('skane');
    expect(districtSlugFromPath('/skane')).toBe('skane');
    expect(districtSlugFromPath('/skane/cup-2026')).toBeNull();
    expect(districtSlugFromPath('/api')).toBeNull();
    expect(districtSlugFromPath('/styles.css')).toBeNull();
  });

  test('resolveDistrictFromSlug maps known federations and ovrigt', () => {
    expect(resolveDistrictFromSlug('skane', { knownNames: ['Skåne', 'Småland'] })).toBe('Skåne');
    expect(resolveDistrictFromSlug('ovrigt', {})).toBe('Övrigt');
    expect(resolveDistrictFromSlug('unknown', {})).toBeNull();
  });

  test('cupDetailUrl uses district + slug-year', () => {
    expect(
      cupDetailUrl({
        name: 'Skånskan Cup',
        ingest_source_name: 'Skåne',
        start_date: '2026-03-01',
      }),
    ).toBe('/skane/skanskan-cup-2026');
    expect(
      cupDetailUrl({
        name: 'Mystery Cup',
        ingest_source_name: '',
        start_date: '2026-05-01',
      }),
    ).toBe('/ovrigt/mystery-cup-2026');
  });

  test('collectDistricts includes Övrigt when ingest is empty', () => {
    expect(collectDistricts([{ ingest_source_name: 'Skåne' }, { ingest_source_name: '' }])).toEqual(
      ['Skåne', 'Övrigt'],
    );
  });

  test('ensureDistrictOption keeps path-selected Övrigt', () => {
    expect(ensureDistrictOption(['Skåne'], 'Övrigt')).toEqual(['Skåne', 'Övrigt']);
    expect(ensureDistrictOption(['Skåne'], 'Skåne')).toEqual(['Skåne']);
  });

  test('districtPath and districtToSlug stay aligned', () => {
    expect(districtToSlug('Jämtland-Härjedalen')).toBe('jamtland-harjedalen');
    expect(districtPath('Skåne')).toBe('/skane/');
  });
});
