// plugins/guides/__tests__/validation.test.js
const { AppError } = require('../../../server/core/errors/AppError');
const {
  MASTER_GUIDE_EDITORIAL_STATUSES,
  PLACE_LIFECYCLE_STATUSES,
  PUBLICATION_STATUSES,
  STALENESS_STATUSES,
  parseLifecycleStatus,
  parseMasterGuideEditorialStatus,
  parseSourceLanguage,
  parsePublicationStatus,
  parseStalenessStatus,
  parseLanguage,
} = require('../validation');

describe('guides validation', () => {
  test('parseLifecycleStatus accepts known values', () => {
    expect(parseLifecycleStatus('active')).toBe('active');
    expect(parseLifecycleStatus('archived')).toBe('archived');
  });

  test('parseLifecycleStatus defaults empty values to draft', () => {
    expect(parseLifecycleStatus(null)).toBe('draft');
    expect(parseLifecycleStatus(undefined)).toBe('draft');
    expect(parseLifecycleStatus('')).toBe('draft');
  });

  test('parseLifecycleStatus rejects unknown values', () => {
    expect(() => parseLifecycleStatus('unknown')).toThrow(AppError);
  });

  test('parseSourceLanguage accepts ISO-like codes', () => {
    expect(parseSourceLanguage('sv')).toBe('sv');
    expect(parseSourceLanguage('en-US')).toBe('en-us');
  });

  test('parseSourceLanguage defaults to sv when omitted', () => {
    expect(parseSourceLanguage()).toBe('sv');
    expect(parseSourceLanguage(null)).toBe('sv');
  });

  test('parseSourceLanguage rejects invalid codes', () => {
    expect(() => parseSourceLanguage('123')).toThrow(AppError);
    expect(() => parseSourceLanguage('english')).toThrow(AppError);
  });

  test('PLACE_LIFECYCLE_STATUSES contains draft, active, archived', () => {
    expect(PLACE_LIFECYCLE_STATUSES).toEqual(['draft', 'active', 'archived']);
  });

  test('parseMasterGuideEditorialStatus accepts known values', () => {
    expect(parseMasterGuideEditorialStatus('draft')).toBe('draft');
    expect(parseMasterGuideEditorialStatus('in-progress')).toBe('in-progress');
    expect(parseMasterGuideEditorialStatus('complete')).toBe('complete');
  });

  test('parseMasterGuideEditorialStatus defaults empty values to draft', () => {
    expect(parseMasterGuideEditorialStatus(null)).toBe('draft');
    expect(parseMasterGuideEditorialStatus(undefined)).toBe('draft');
    expect(parseMasterGuideEditorialStatus('')).toBe('draft');
  });

  test('parseMasterGuideEditorialStatus rejects unknown values', () => {
    expect(() => parseMasterGuideEditorialStatus('published')).toThrow(AppError);
  });

  test('MASTER_GUIDE_EDITORIAL_STATUSES contains draft, in-progress, complete', () => {
    expect(MASTER_GUIDE_EDITORIAL_STATUSES).toEqual(['draft', 'in-progress', 'complete']);
  });

  test('parsePublicationStatus accepts draft, ready, published', () => {
    expect(parsePublicationStatus('ready')).toBe('ready');
    expect(parsePublicationStatus('published')).toBe('published');
  });

  test('parsePublicationStatus defaults empty values to draft', () => {
    expect(parsePublicationStatus(null)).toBe('draft');
    expect(parsePublicationStatus(undefined)).toBe('draft');
    expect(parsePublicationStatus('')).toBe('draft');
  });

  test('parsePublicationStatus rejects unknown values', () => {
    expect(() => parsePublicationStatus('live')).toThrow(AppError);
  });

  test('PUBLICATION_STATUSES contains draft, ready, published', () => {
    expect(PUBLICATION_STATUSES).toEqual(['draft', 'ready', 'published']);
  });

  test('parseStalenessStatus accepts fresh and stale', () => {
    expect(parseStalenessStatus('fresh')).toBe('fresh');
    expect(parseStalenessStatus('stale')).toBe('stale');
  });

  test('parseStalenessStatus defaults empty values to fresh', () => {
    expect(parseStalenessStatus(null)).toBe('fresh');
    expect(parseStalenessStatus(undefined)).toBe('fresh');
    expect(parseStalenessStatus('')).toBe('fresh');
  });

  test('parseStalenessStatus rejects unknown values', () => {
    expect(() => parseStalenessStatus('outdated')).toThrow(AppError);
  });

  test('STALENESS_STATUSES contains fresh and stale', () => {
    expect(STALENESS_STATUSES).toEqual(['fresh', 'stale']);
  });

  test('parseLanguage delegates to parseSourceLanguage', () => {
    expect(parseLanguage('en')).toBe('en');
    expect(() => parseLanguage('invalid')).toThrow(AppError);
  });
});
