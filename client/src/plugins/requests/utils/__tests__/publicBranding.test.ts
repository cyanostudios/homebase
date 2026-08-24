import { DEFAULT_REQUEST_TYPES } from '../../types/requests';
import {
  normalizePublicBranding,
  resolvePublicRequestTypes,
  resolvePublicWebsiteHref,
} from '../publicBranding';

describe('normalizePublicBranding', () => {
  it('maps name, logoUrl, website, email, and legacy string requestTypes', () => {
    expect(
      normalizePublicBranding({
        name: 'Homebase FC',
        logoUrl: 'https://example.com/logo.png',
        website: 'https://example.com',
        email: 'info@example.com',
        requestTypes: ['general', 'Kläder', 'other'],
      }),
    ).toEqual({
      name: 'Homebase FC',
      logoUrl: 'https://example.com/logo.png',
      website: 'https://example.com',
      email: 'info@example.com',
      requestTypes: [{ key: 'general' }, { key: 'Kläder' }, { key: 'other' }],
    });
  });

  it('maps object requestTypes with plugin and intakeSchema and strips targetListId', () => {
    expect(
      normalizePublicBranding({
        name: 'Club',
        logoUrl: '',
        website: '',
        email: '',
        requestTypes: [
          {
            key: 'Kläder',
            plugin: 'garments',
            targetListId: 'should-not-appear',
            intakeSchema: [{ key: 'name', required: true }, { key: 'shirtSize' }],
          },
        ],
      }),
    ).toEqual({
      name: 'Club',
      logoUrl: '',
      website: '',
      email: '',
      requestTypes: [
        {
          key: 'Kläder',
          plugin: 'garments',
          intakeSchema: [{ key: 'name', required: true }, { key: 'shirtSize' }],
        },
      ],
    });
  });

  it('filters blank and invalid requestTypes entries', () => {
    expect(
      normalizePublicBranding({
        name: 'Club',
        logoUrl: 'https://example.com/a.png',
        website: 'example.com',
        email: 'a@b.se',
        requestTypes: ['general', '', '  ', 42, null, 'Kläder', undefined],
      }),
    ).toEqual({
      name: 'Club',
      logoUrl: 'https://example.com/a.png',
      website: 'example.com',
      email: 'a@b.se',
      requestTypes: [{ key: 'general' }, { key: 'Kläder' }],
    });
  });

  it('returns empty strings and empty requestTypes when fields are missing', () => {
    expect(normalizePublicBranding({})).toEqual({
      name: '',
      logoUrl: '',
      website: '',
      email: '',
      requestTypes: [],
    });
  });

  it('returns empty shape for null/non-object payloads', () => {
    expect(normalizePublicBranding(null)).toEqual({
      name: '',
      logoUrl: '',
      website: '',
      email: '',
      requestTypes: [],
    });
    expect(normalizePublicBranding('bad')).toEqual({
      name: '',
      logoUrl: '',
      website: '',
      email: '',
      requestTypes: [],
    });
  });

  it('coerces non-string name/logoUrl/website/email to empty strings', () => {
    expect(
      normalizePublicBranding({
        name: 123,
        logoUrl: { url: 'x' },
        website: 1,
        email: false,
        requestTypes: 'not-an-array',
      }),
    ).toEqual({
      name: '',
      logoUrl: '',
      website: '',
      email: '',
      requestTypes: [],
    });
  });
});

describe('resolvePublicRequestTypes', () => {
  it('uses settings types when non-empty', () => {
    expect(resolvePublicRequestTypes([{ key: 'Kläder' }, { key: 'other' }])).toEqual([
      { key: 'Kläder' },
      { key: 'other' },
    ]);
  });

  it('falls back to DEFAULT_REQUEST_TYPES when empty', () => {
    expect(resolvePublicRequestTypes([])).toEqual(DEFAULT_REQUEST_TYPES.map((key) => ({ key })));
  });
});

describe('resolvePublicWebsiteHref', () => {
  it('returns empty for blank input', () => {
    expect(resolvePublicWebsiteHref('')).toBe('');
    expect(resolvePublicWebsiteHref('   ')).toBe('');
  });

  it('keeps absolute http(s) URLs', () => {
    expect(resolvePublicWebsiteHref('https://example.com')).toBe('https://example.com');
    expect(resolvePublicWebsiteHref('http://example.com/path')).toBe('http://example.com/path');
  });

  it('prefixes https when scheme is missing', () => {
    expect(resolvePublicWebsiteHref('example.com')).toBe('https://example.com');
  });
});
