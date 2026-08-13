/**
 * Helpers for Cupappen pageview admin stats (Homebase).
 */

function clampPageviewDays(raw, { defaultDays = 30, min = 1, max = 90 } = {}) {
  const n = parseInt(String(raw ?? defaultDays), 10);
  if (!Number.isFinite(n)) return defaultDays;
  return Math.min(max, Math.max(min, n));
}

/**
 * Format a Date as YYYY-MM-DD in local calendar (matches PG DATE string form).
 * @param {Date} d
 * @returns {string}
 */
function formatDayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Build a contiguous daily series ending on `endDate` (inclusive), filling missing days with 0.
 * @param {number} days
 * @param {Array<{ day: string|Date, views: number|string }>} rows
 * @param {{ endDate?: Date }} [opts]
 * @returns {Array<{ day: string, views: number }>}
 */
function fillPageviewSeries(days, rows, { endDate = new Date() } = {}) {
  const n = Math.max(1, Math.floor(Number(days)) || 1);
  const byDay = new Map();
  for (const r of rows || []) {
    let key;
    if (r.day instanceof Date) {
      key = formatDayKey(r.day);
    } else {
      key = String(r.day ?? '').slice(0, 10);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    byDay.set(key, Number(r.views) || 0);
  }

  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const series = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const key = formatDayKey(d);
    series.push({ day: key, views: byDay.get(key) || 0 });
  }
  return series;
}

module.exports = { clampPageviewDays, fillPageviewSeries, formatDayKey };
