/**
 * Helpers for Cupappen pageview admin stats (Homebase).
 */

function clampPageviewDays(raw, { defaultDays = 30, min = 1, max = 90 } = {}) {
  const n = parseInt(String(raw ?? defaultDays), 10);
  if (!Number.isFinite(n)) return defaultDays;
  return Math.min(max, Math.max(min, n));
}

module.exports = { clampPageviewDays };
