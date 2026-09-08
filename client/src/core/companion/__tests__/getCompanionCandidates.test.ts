import type { PluginRegistryEntry } from '@/core/pluginRegistry';
import {
  getCompanionCandidates,
  isCompanionEnabled,
  isRegisteredCompanionPlugin,
} from '@/core/companion/getCompanionCandidates';

function entry(
  partial: Pick<PluginRegistryEntry, 'name'> &
    Partial<Pick<PluginRegistryEntry, 'canOpenAsCompanionFor' | 'components'>>,
): PluginRegistryEntry {
  return {
    name: partial.name,
    Provider: (() => null) as PluginRegistryEntry['Provider'],
    hook: () => ({}),
    panelKey: 'isPanelOpen',
    components: partial.components ?? {
      List: (() => null) as PluginRegistryEntry['components']['List'],
    },
    canOpenAsCompanionFor: partial.canOpenAsCompanionFor,
  };
}

describe('getCompanionCandidates', () => {
  const registry: PluginRegistryEntry[] = [
    entry({ name: 'schedule', canOpenAsCompanionFor: ['teams'] }),
    entry({ name: 'garments', canOpenAsCompanionFor: ['teams'] }),
    entry({ name: 'notes', canOpenAsCompanionFor: ['contacts'] }),
    entry({ name: 'no-list', canOpenAsCompanionFor: ['teams'], components: {} }),
    entry({ name: 'no-companion' }),
    entry({ name: 'empty-hosts', canOpenAsCompanionFor: [] }),
  ];

  it('returns all enabled companions with a non-empty canOpenAsCompanionFor', () => {
    const result = getCompanionCandidates(new Set(['schedule', 'garments', 'notes']), registry);
    expect(result.map((e) => e.name)).toEqual(['schedule', 'garments', 'notes']);
  });

  it('omits disabled plugins', () => {
    const result = getCompanionCandidates(new Set(['schedule']), registry);
    expect(result.map((e) => e.name)).toEqual(['schedule']);
  });

  it('omits entries without List', () => {
    const result = getCompanionCandidates(new Set(['no-list']), registry);
    expect(result).toEqual([]);
  });

  it('omits entries without companion declaration', () => {
    const result = getCompanionCandidates(new Set(['no-companion', 'empty-hosts']), registry);
    expect(result).toEqual([]);
  });

  it('ignores host-page matrix (global companions)', () => {
    const result = getCompanionCandidates(new Set(['notes']), registry);
    expect(result.map((e) => e.name)).toEqual(['notes']);
  });
});

describe('isRegisteredCompanionPlugin / isCompanionEnabled', () => {
  const registry: PluginRegistryEntry[] = [
    entry({ name: 'schedule', canOpenAsCompanionFor: ['teams'] }),
    entry({ name: 'no-companion' }),
  ];

  it('accepts registry companion plugins and rejects junk / non-companions', () => {
    expect(isRegisteredCompanionPlugin('schedule', registry)).toBe(true);
    expect(isRegisteredCompanionPlugin('no-companion', registry)).toBe(false);
    expect(isRegisteredCompanionPlugin('not-a-plugin', registry)).toBe(false);
    expect(isRegisteredCompanionPlugin('', registry)).toBe(false);
  });

  it('requires tenant enablement for isCompanionEnabled', () => {
    expect(isCompanionEnabled('schedule', new Set(['schedule']), registry)).toBe(true);
    expect(isCompanionEnabled('schedule', new Set(['teams']), registry)).toBe(false);
  });
});
