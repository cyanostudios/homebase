import { formatDurationMs } from '../guideAudioFormat';

describe('formatDurationMs', () => {
  test('formats whole minutes and seconds', () => {
    expect(formatDurationMs(0)).toBe('0:00');
    expect(formatDurationMs(1000)).toBe('0:01');
    expect(formatDurationMs(65_000)).toBe('1:05');
  });

  test('returns empty string for invalid input', () => {
    expect(formatDurationMs(null)).toBe('');
    expect(formatDurationMs(undefined)).toBe('');
    expect(formatDurationMs(-1)).toBe('');
    expect(formatDurationMs(Number.NaN)).toBe('');
  });
});
