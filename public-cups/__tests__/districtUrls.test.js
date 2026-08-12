const {
  slugify,
  districtToSlug,
  districtPath,
  districtSlugFromPath,
  appTabFromPath,
  appPathForTab,
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
    expect(districtSlugFromPath('/sok/')).toBeNull();
    expect(districtSlugFromPath('/kommande/')).toBeNull();
    expect(districtSlugFromPath('/alla/')).toBeNull();
    expect(districtSlugFromPath('/info/')).toBeNull();
    expect(districtSlugFromPath('/distrikt/')).toBeNull();
  });

  test('appTabFromPath maps listing segments including districts index', () => {
    expect(appTabFromPath('/sok/')).toBe('search');
    expect(appTabFromPath('/kommande/')).toBe('upcoming');
    expect(appTabFromPath('/alla/')).toBe('all');
    expect(appTabFromPath('/info/')).toBe('info');
    expect(appTabFromPath('/distrikt/')).toBe('districts');
    expect(appTabFromPath('/distrikt')).toBe('districts');
    expect(appTabFromPath('/skane/')).toBeNull();
  });

  test('appPathForTab includes districts index', () => {
    expect(appPathForTab('districts')).toBe('/distrikt/');
    expect(appPathForTab('home')).toBe('/');
  });

  test('appTabFromPath / appPathForTab map listing tabs', () => {
    expect(appTabFromPath('/sok/')).toBe('search');
    expect(appTabFromPath('/kommande')).toBe('upcoming');
    expect(appTabFromPath('/alla/')).toBe('all');
    expect(appTabFromPath('/info/')).toBe('info');
    expect(appTabFromPath('/skane/')).toBeNull();
    expect(appPathForTab('search')).toBe('/sok/');
    expect(appPathForTab('upcoming')).toBe('/kommande/');
    expect(appPathForTab('home')).toBe('/');
    expect(appPathForTab('district')).toBe('/');
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
        start_date: '2026-01-01',
      }),
    ).toBe('/ovrigt/mystery-cup-2026');
  });

  test('collectDistricts includes Övrigt when ingest is empty', () => {
    expect(
      collectDistricts([
        { ingest_source_name: 'Skåne' },
        { ingest_source_name: '' },
        { ingest_source_name: 'Skåne' },
      ]),
    ).toEqual(['Skåne', 'Övrigt']);
  });

  test('ensureDistrictOption keeps path-selected Övrigt', () => {
    expect(ensureDistrictOption(['Skåne'], 'Övrigt')).toEqual(['Skåne', 'Övrigt']);
  });

  test('districtPath and districtToSlug stay aligned', () => {
    expect(districtPath('Skåne')).toBe('/skane/');
    expect(districtToSlug('Jämtland-Härjedalen')).toBe('jamtland-harjedalen');
  });
});
