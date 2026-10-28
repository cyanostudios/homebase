import { formatSiteAuditDuration, siteAuditRunDurationMs } from '../siteAuditDuration';

describe('formatSiteAuditDuration', () => {
  test('formats under an hour as m:ss', () => {
    expect(formatSiteAuditDuration(0)).toBe('0:00');
    expect(formatSiteAuditDuration(5_000)).toBe('0:05');
    expect(formatSiteAuditDuration(65_000)).toBe('1:05');
    expect(formatSiteAuditDuration(600_000)).toBe('10:00');
  });

  test('formats hours as h:mm:ss', () => {
    expect(formatSiteAuditDuration(3_661_000)).toBe('1:01:01');
  });

  test('invalid values become em dash', () => {
    expect(formatSiteAuditDuration(null)).toBe('—');
    expect(formatSiteAuditDuration(-1)).toBe('—');
  });
});

describe('siteAuditRunDurationMs', () => {
  test('uses finishedAt when present', () => {
    expect(siteAuditRunDurationMs('2026-10-22T10:00:00.000Z', '2026-10-22T10:01:30.000Z')).toBe(
      90_000,
    );
  });

  test('uses now when still running', () => {
    expect(
      siteAuditRunDurationMs(
        '2026-10-22T10:00:00.000Z',
        null,
        Date.parse('2026-10-22T10:00:42.000Z'),
      ),
    ).toBe(42_000);
  });
});
