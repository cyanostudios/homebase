/**
 * Format elapsed audit time as m:ss or h:mm:ss (always show minutes).
 */
export function formatSiteAuditDuration(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) {
    return '—';
  }
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm.padStart(2, '0')}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

export function siteAuditRunDurationMs(
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return null;
  const end = finishedAt ? new Date(finishedAt).getTime() : nowMs;
  if (!Number.isFinite(end)) return null;
  return Math.max(0, end - start);
}
