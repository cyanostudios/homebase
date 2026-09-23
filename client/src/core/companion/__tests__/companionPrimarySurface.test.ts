import type { PluginRegistryEntry } from '@/core/pluginRegistry';
import {
  resolveCompanionHideOnPrimaryPages,
  shouldCloseCompanionForPrimary,
  shouldHideCompanionRailForPrimary,
} from '@/core/companion/companionPrimarySurface';

function entry(
  partial: Pick<PluginRegistryEntry, 'name'> &
    Partial<Pick<PluginRegistryEntry, 'companionHideOnPrimaryPages'>>,
): PluginRegistryEntry {
  return {
    name: partial.name,
    Provider: (() => null) as PluginRegistryEntry['Provider'],
    hook: () => ({}),
    panelKey: 'isPanelOpen',
    components: {},
    companionHideOnPrimaryPages: partial.companionHideOnPrimaryPages,
  };
}

describe('companionPrimarySurface', () => {
  const schedule = entry({ name: 'schedule', companionHideOnPrimaryPages: ['schedule'] });
  const garments = entry({
    name: 'garments',
    companionHideOnPrimaryPages: ['garments-inventory'],
  });
  const legacy = entry({ name: 'notes' });

  it('resolves hide surfaces from registry or falls back to plugin name', () => {
    expect(resolveCompanionHideOnPrimaryPages(garments)).toEqual(['garments-inventory']);
    expect(resolveCompanionHideOnPrimaryPages(schedule)).toEqual(['schedule']);
    expect(resolveCompanionHideOnPrimaryPages(legacy)).toEqual(['notes']);
  });

  it('hides garments companion rail only on full inventory primary', () => {
    expect(shouldHideCompanionRailForPrimary(garments, 'garments-inventory')).toBe(true);
    expect(shouldHideCompanionRailForPrimary(garments, 'garments-lists')).toBe(false);
    expect(shouldHideCompanionRailForPrimary(garments, 'garments')).toBe(false);
  });

  it('closes companion when primary matches hide surfaces', () => {
    const registry = [schedule, garments];
    expect(shouldCloseCompanionForPrimary('schedule', 'schedule', registry)).toBe(true);
    expect(shouldCloseCompanionForPrimary('garments', 'garments-inventory', registry)).toBe(true);
    expect(shouldCloseCompanionForPrimary('garments', 'garments-lists', registry)).toBe(false);
  });
});
