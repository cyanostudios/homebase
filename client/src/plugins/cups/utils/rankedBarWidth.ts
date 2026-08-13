/** Width of a rank bar as percent of the max value in the list (0–100). */
export function barWidthPercent(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}
