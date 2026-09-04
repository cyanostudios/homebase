const { parseFogisStartTime } = require('../matchImportService');

describe('parseFogisStartTime', () => {
  test('keeps wall-clock when timezone is missing', () => {
    expect(parseFogisStartTime({ timeAsDateTime: '2026-01-10T10:30:00' })).toBe(
      '2026-01-10T10:30:00',
    );
  });

  test('normalizes to UTC ISO when Z is present', () => {
    const iso = parseFogisStartTime({ timeAsDateTime: '2026-01-10T10:30:00Z' });
    expect(iso).toBe(new Date('2026-01-10T10:30:00Z').toISOString());
  });

  test('normalizes to UTC ISO when numeric offset is present', () => {
    const iso = parseFogisStartTime({ timeAsDateTime: '2026-01-10T13:30:00+02:00' });
    expect(iso).toBe(new Date('2026-01-10T13:30:00+02:00').toISOString());
  });
});
