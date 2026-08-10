import { isHour12, setTimeFormat, DEFAULT_TIME_FORMAT } from '@/core/settings/timeFormatPreference';
import { formatMatchDateTime } from '../match';

describe('formatMatchDateTime', () => {
  afterEach(() => {
    setTimeFormat(DEFAULT_TIME_FORMAT);
  });

  it('follows Preferences hour cycle even when locale is en', () => {
    const start = '2026-08-10T15:30:00';
    setTimeFormat('24h');
    const with24 = formatMatchDateTime(start, 'en');
    expect(with24).toMatch(/15:30/);
    expect(with24).not.toMatch(/AM|PM/i);

    setTimeFormat('12h');
    const with12 = formatMatchDateTime(start, 'en');
    expect(with12).toMatch(/AM|PM/i);
    expect(isHour12()).toBe(true);
  });
});
