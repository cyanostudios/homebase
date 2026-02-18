// client/src/core/pluginSingular.ts
// Shared singular form for plugin names (e.g. matches -> match) so core and plugins stay in sync.

const IRREGULAR: Record<string, string> = { matches: 'match', slots: 'slot' };
const toCamel = (name: string) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export function getSingular(pluginName: string): string {
  const camel = toCamel(pluginName);
  return IRREGULAR[camel] ?? (camel.endsWith('s') ? camel.slice(0, -1) : camel);
}

export function getSingularCap(pluginName: string): string {
  const s = getSingular(pluginName);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
