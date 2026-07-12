// plugins/guides/__tests__/guideAudioFormat.test.js
// Mirrors client/src/plugins/guides/utils/guideAudioFormat.ts for unit coverage.

function formatDurationMs(durationMs) {
  if (durationMs == null || durationMs < 0 || !Number.isFinite(durationMs)) {
    return '';
  }
  const totalSec = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

describe('guide audio formatDurationMs', () => {
  test('formats seconds and minutes', () => {
    expect(formatDurationMs(45000)).toBe('0:45');
    expect(formatDurationMs(125000)).toBe('2:05');
  });

  test('returns empty for invalid values', () => {
    expect(formatDurationMs(null)).toBe('');
    expect(formatDurationMs(-1)).toBe('');
    expect(formatDurationMs(Number.NaN)).toBe('');
  });
});
