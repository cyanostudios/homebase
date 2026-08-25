export type PlayerCountHistoryEntry = {
  at: string;
  count: number;
};

export type PlayersMonthPoint = {
  /** YYYY-MM */
  monthKey: string;
  value: number;
};

const MAX_MONTHS_DEFAULT = 12;

function toMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthKeyFromAt(at: string | null | undefined): string | null {
  if (!at) return null;
  const isoMonth = String(at).match(/^(\d{4}-\d{2})/);
  if (isoMonth) return isoMonth[1];
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return toMonthKey(d);
}

function eachMonthInclusive(startKey: string, endKey: string): string[] {
  const [sy, sm] = startKey.split('-').map(Number);
  const [ey, em] = endKey.split('-').map(Number);
  if (!sy || !sm || !ey || !em) return [];

  const out: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [yRaw, mRaw] = monthKey.split('-').map(Number);
  const d = new Date(yRaw, mRaw - 1 + delta, 1);
  return toMonthKey(d);
}

function normalizeHistory(
  history: PlayerCountHistoryEntry[] | null | undefined,
  fallback: { created_at?: string | null; player_count?: number | null },
): PlayerCountHistoryEntry[] {
  const cleaned = (history ?? [])
    .filter((e) => e && typeof e.at === 'string' && e.at.trim())
    .map((e) => ({
      at: e.at.trim(),
      count: Math.max(0, Number(e.count) || 0),
    }))
    .sort((a, b) => a.at.localeCompare(b.at));

  if (cleaned.length > 0) return cleaned;

  const at = fallback.created_at?.trim() || new Date().toISOString();
  return [{ at, count: Math.max(0, Number(fallback.player_count) || 0) }];
}

/** Last known count for a team as of monthKey (inclusive). */
function effectiveCountForMonth(history: PlayerCountHistoryEntry[], monthKey: string): number {
  let effective: number | null = null;
  for (const entry of history) {
    const mk = monthKeyFromAt(entry.at);
    if (mk && mk <= monthKey) {
      effective = entry.count;
    }
  }
  return effective ?? 0;
}

/**
 * Monthly player totals from per-team player_count_history.
 * For each month: sum each team's last history entry with at ≤ that month.
 */
export function buildPlayersByMonth(
  teams: Array<{
    created_at?: string | null;
    player_count?: number | null;
    player_count_history?: PlayerCountHistoryEntry[] | null;
  }>,
  options?: { now?: Date; maxMonths?: number },
): PlayersMonthPoint[] {
  const now = options?.now ?? new Date();
  const maxMonths = options?.maxMonths ?? MAX_MONTHS_DEFAULT;
  const endKey = toMonthKey(now);

  if (teams.length === 0) return [];

  const teamHistories = teams.map((team) =>
    normalizeHistory(team.player_count_history, {
      created_at: team.created_at,
      player_count: team.player_count,
    }),
  );

  let startKey = endKey;
  for (const history of teamHistories) {
    const first = monthKeyFromAt(history[0]?.at);
    if (first && first < startKey) startKey = first;
  }

  const earliestAllowed = shiftMonthKey(endKey, -(maxMonths - 1));
  if (startKey < earliestAllowed) startKey = earliestAllowed;
  if (startKey > endKey) startKey = endKey;

  const months = eachMonthInclusive(startKey, endKey);
  return months.map((monthKey) => ({
    monthKey,
    value: teamHistories.reduce(
      (sum, history) => sum + effectiveCountForMonth(history, monthKey),
      0,
    ),
  }));
}

/** Format YYYY-MM for chart axis (e.g. "Jan"). */
export function formatPlayersMonthLabel(monthKey: string, locale?: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(locale || undefined, { month: 'short' });
}
