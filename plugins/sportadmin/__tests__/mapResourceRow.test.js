/**
 * Thin contract test: team API mapping exposes description for Teams detail.
 * mapResourceRow is module-private — exercise via the same shape as controller.
 */
const { parseTeamFromDiscovery } = require('../parser/TeamParser');
const { normalizeResource } = require('../normalizer/normalize');

function mapResourceRow(row) {
  const payload = row.payload || {};
  const base = {
    id: row.id,
    source: row.source,
    source_id: row.source_id,
    type: row.type,
    source_url: row.source_url,
    source_image_url: row.source_image_url,
    imported_at: row.imported_at,
    updated_at: row.updated_at,
  };
  if (row.type === 'team') {
    return {
      ...base,
      name: payload.name,
      category: payload.category,
      age_group: payload.age_group,
      heading: payload.heading ?? null,
      description: payload.description ?? null,
      upcoming_matches: Array.isArray(payload.upcoming_matches) ? payload.upcoming_matches : [],
      played_matches: Array.isArray(payload.played_matches) ? payload.played_matches : [],
      news_items: Array.isArray(payload.news_items) ? payload.news_items : [],
      modules: payload.modules ?? null,
      players: Array.isArray(payload.players) ? payload.players : [],
      leaders: Array.isArray(payload.leaders) ? payload.leaders : [],
      contact: payload.contact ?? null,
      source_url: row.source_url,
    };
  }
  return { ...base, ...payload };
}

describe('SportAdmin team mapResourceRow', () => {
  test('exposes description and source_image_url for Teams detail', () => {
    const parsed = parseTeamFromDiscovery(
      {
        sid: '54741',
        name: 'P10 (2016)',
        category: 'Pojklag',
        href: 'https://example.com/?SID=54741',
      },
      'https://example.com/?SID=54741',
      '<html><head><meta property="og:description" content="Welcome to P10" /><meta property="og:image" content="https://cdn.example.com/logo.png" /></head></html>',
    );
    const normalized = normalizeResource(parsed);
    const row = {
      id: 'sportadmin:team:54741',
      source: 'sportadmin',
      source_id: '54741',
      type: 'team',
      source_url: normalized.source_url,
      source_image_url: normalized.source_image_url,
      imported_at: '2026-09-25T08:00:00.000Z',
      updated_at: '2026-09-25T08:00:00.000Z',
      payload: normalized.payload,
    };
    const mapped = mapResourceRow(row);
    expect(mapped.description).toMatch(/Welcome to P10/i);
    expect(mapped.source_image_url).toMatch(/^https:\/\//);
    expect(mapped.name).toBe('P10 (2016)');
    expect(mapped.category).toBe('Pojklag');
    expect(mapped.news_items).toEqual([]);
  });
});
