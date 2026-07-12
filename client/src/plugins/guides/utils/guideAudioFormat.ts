/** Format milliseconds as m:ss for audio duration display. */
export function formatDurationMs(durationMs: number | null | undefined): string {
  if (durationMs == null || durationMs < 0 || !Number.isFinite(durationMs)) {
    return '';
  }
  const totalSec = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
