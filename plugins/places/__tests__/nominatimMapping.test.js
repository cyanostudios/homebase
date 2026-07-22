const NominatimPlaceProvider = require('../adapters/NominatimPlaceProvider');
const { mapNominatimItem, buildProviderRef, mapBoundingBox } = NominatimPlaceProvider;

describe('NominatimPlaceProvider mapping', () => {
  test('maps Nominatim item to PlaceResolved', () => {
    const mapped = mapNominatimItem(
      {
        osm_type: 'way',
        osm_id: 123,
        name: 'Colosseum',
        display_name: 'Colosseum, Rome, Italy',
        lat: '41.8902',
        lon: '12.4922',
        category: 'tourism',
        type: 'attraction',
        addresstype: 'attraction',
        address: {
          country_code: 'it',
          state: 'Lazio',
          city: 'Rome',
        },
        boundingbox: ['41.88', '41.90', '12.48', '12.50'],
      },
      { resolvedAt: '2026-07-18T00:00:00.000Z' },
    );

    expect(mapped.provider).toBe('nominatim');
    expect(mapped.providerRef).toBe('W123');
    expect(mapped.displayName).toBe('Colosseum');
    expect(mapped.coordinates).toEqual({ lat: 41.8902, lng: 12.4922 });
    expect(mapped.countryCode).toBe('IT');
    expect(mapped.locality).toBe('Rome');
    expect(mapped.bbox).toEqual([12.48, 41.88, 12.5, 41.9]);
    expect(buildProviderRef({ osm_type: 'node', osm_id: 9 })).toBe('N9');
    expect(mapBoundingBox(['1', '2', '3', '4'])).toEqual([3, 1, 4, 2]);
  });
});

describe('NominatimPlaceProvider search with countryCode', () => {
  test('passes countrycodes param to Nominatim when countryCode option is set', async () => {
    const captured = { url: null };
    const mockFetch = async (url) => {
      captured.url = url;
      return { ok: true, json: async () => [] };
    };
    const provider = new NominatimPlaceProvider({ fetchFn: mockFetch });
    await provider.search('Colosseum', { countryCode: 'IT' });
    expect(captured.url).toContain('countrycodes=it');
  });

  test('does not pass countrycodes when countryCode is not set', async () => {
    const captured = { url: null };
    const mockFetch = async (url) => {
      captured.url = url;
      return { ok: true, json: async () => [] };
    };
    const provider = new NominatimPlaceProvider({ fetchFn: mockFetch });
    await provider.search('Colosseum');
    expect(captured.url).not.toContain('countrycodes');
  });
});
