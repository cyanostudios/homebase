/**
 * Display prefixes for entity numbers (CNT-1, EST-2025-001).
 * Kept separate from pluginRegistry so Vite vendor-shared can import this
 * without pulling every plugin NullProvider into the shared chunk.
 */
const DISPLAY_PREFIX_BY_PLUGIN: Record<string, string> = {
  contacts: 'CNT',
  notes: 'NTS',
  tasks: 'TSK',
  estimates: 'EST',
  invoices: 'INV',
  files: 'FLS',
  teams: 'TEAM',
  matches: 'MAT',
  garments: 'GRM',
  requests: 'REQ',
  slots: 'SLT',
  cups: 'CUP',
  ingest: 'ING',
  guides: 'GDS',
  instructions: 'INS',
  clubdesk: 'CDK',
  mail: 'MAIL',
  pulses: 'PULSE',
};

/**
 * Returns the display prefix for a plugin (e.g. CNT, NTS).
 * Used when formatting entity numbers for display (e.g. CNT-1, EST-2025-001).
 */
export function getDisplayPrefix(pluginName: string): string {
  return DISPLAY_PREFIX_BY_PLUGIN[pluginName] ?? '';
}

/**
 * Formats a number or id for display with the plugin's prefix.
 * Returns "PREFIX-number" if prefix exists, otherwise the raw number.
 * Handles empty number to avoid "PREFIX-" with nothing after.
 */
export function formatDisplayNumber(pluginName: string, numberOrId: string): string {
  const prefix = getDisplayPrefix(pluginName);
  const num = String(numberOrId ?? '').trim();
  if (!prefix) {
    return num;
  }
  if (!num) {
    return prefix;
  }
  return `${prefix}-${num}`;
}
