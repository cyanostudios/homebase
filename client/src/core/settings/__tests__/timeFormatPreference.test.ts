import {
  DEFAULT_TIME_FORMAT,
  getTimeFormat,
  isHour12,
  parseTimeFormat,
  setTimeFormat,
  subscribeTimeFormat,
} from '../timeFormatPreference';
import { formatDateTime, formatDateTimeShort, formatTime } from '../../utils/dateFormat';

describe('timeFormatPreference', () => {
  afterEach(() => {
    setTimeFormat(DEFAULT_TIME_FORMAT);
  });

  it('defaults to 24h', () => {
    expect(getTimeFormat()).toBe('24h');
    expect(isHour12()).toBe(false);
  });

  it('parseTimeFormat accepts only 12h/24h', () => {
    expect(parseTimeFormat('12h')).toBe('12h');
    expect(parseTimeFormat('24h')).toBe('24h');
    expect(parseTimeFormat('bogus')).toBeNull();
    expect(parseTimeFormat(undefined)).toBeNull();
  });

  it('notifies subscribers when format changes', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeTimeFormat(() => seen.push(getTimeFormat()));
    setTimeFormat('12h');
    setTimeFormat('12h'); // no-op
    setTimeFormat('24h');
    unsubscribe();
    expect(seen).toEqual(['12h', '24h']);
  });
});

describe('dateFormat hour cycle', () => {
  const sample = '2026-08-10T15:30:00';

  afterEach(() => {
    setTimeFormat(DEFAULT_TIME_FORMAT);
  });

  it('uses 24-hour clock when Preferences is 24h', () => {
    setTimeFormat('24h');
    expect(formatTime(sample)).toMatch(/15:30/);
    expect(formatTime(sample)).not.toMatch(/AM|PM/i);
    expect(formatDateTime(sample)).toMatch(/15:30/);
    expect(formatDateTimeShort(sample)).toMatch(/15:30/);
  });

  it('uses 12-hour clock when Preferences is 12h', () => {
    setTimeFormat('12h');
    const time = formatTime(sample);
    // sv-SE uses fm/em; English locales use AM/PM
    expect(time).toMatch(/AM|PM|fm|em/i);
    expect(time).not.toMatch(/\b15:30\b/);
    expect(formatDateTime(sample)).toMatch(/AM|PM|fm|em/i);
  });
});
