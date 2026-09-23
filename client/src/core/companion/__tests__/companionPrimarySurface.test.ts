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
  const contacts = entry({ name: 'contacts', companionHideOnPrimaryPages: ['contacts'] });
  const notes = entry({ name: 'notes', companionHideOnPrimaryPages: ['notes'] });
  const tasks = entry({ name: 'tasks', companionHideOnPrimaryPages: ['tasks'] });
  const requests = entry({ name: 'requests', companionHideOnPrimaryPages: ['requests'] });
  const legacy = entry({ name: 'estimates' });

  it('resolves hide surfaces from registry or falls back to plugin name', () => {
    expect(resolveCompanionHideOnPrimaryPages(garments)).toEqual(['garments-inventory']);
    expect(resolveCompanionHideOnPrimaryPages(schedule)).toEqual(['schedule']);
    expect(resolveCompanionHideOnPrimaryPages(contacts)).toEqual(['contacts']);
    expect(resolveCompanionHideOnPrimaryPages(notes)).toEqual(['notes']);
    expect(resolveCompanionHideOnPrimaryPages(tasks)).toEqual(['tasks']);
    expect(resolveCompanionHideOnPrimaryPages(requests)).toEqual(['requests']);
    expect(resolveCompanionHideOnPrimaryPages(legacy)).toEqual(['estimates']);
  });

  it('hides garments companion rail only on full inventory primary', () => {
    expect(shouldHideCompanionRailForPrimary(garments, 'garments-inventory')).toBe(true);
    expect(shouldHideCompanionRailForPrimary(garments, 'garments-lists')).toBe(false);
    expect(shouldHideCompanionRailForPrimary(garments, 'garments')).toBe(false);
  });

  it('hides contacts companion rail only on contacts primary', () => {
    expect(shouldHideCompanionRailForPrimary(contacts, 'contacts')).toBe(true);
    expect(shouldHideCompanionRailForPrimary(contacts, 'teams')).toBe(false);
    expect(shouldHideCompanionRailForPrimary(contacts, 'schedule')).toBe(false);
  });

  it('hides notes/tasks/requests companions on their primary pages only', () => {
    expect(shouldHideCompanionRailForPrimary(notes, 'notes')).toBe(true);
    expect(shouldHideCompanionRailForPrimary(notes, 'tasks')).toBe(false);
    expect(shouldHideCompanionRailForPrimary(tasks, 'tasks')).toBe(true);
    expect(shouldHideCompanionRailForPrimary(tasks, 'notes')).toBe(false);
    expect(shouldHideCompanionRailForPrimary(requests, 'requests')).toBe(true);
    expect(shouldHideCompanionRailForPrimary(requests, 'contacts')).toBe(false);
  });

  it('closes companion when primary matches hide surfaces', () => {
    const registry = [schedule, garments, contacts, notes, tasks, requests];
    expect(shouldCloseCompanionForPrimary('schedule', 'schedule', registry)).toBe(true);
    expect(shouldCloseCompanionForPrimary('garments', 'garments-inventory', registry)).toBe(true);
    expect(shouldCloseCompanionForPrimary('garments', 'garments-lists', registry)).toBe(false);
    expect(shouldCloseCompanionForPrimary('contacts', 'contacts', registry)).toBe(true);
    expect(shouldCloseCompanionForPrimary('contacts', 'teams', registry)).toBe(false);
    expect(shouldCloseCompanionForPrimary('notes', 'notes', registry)).toBe(true);
    expect(shouldCloseCompanionForPrimary('tasks', 'tasks', registry)).toBe(true);
    expect(shouldCloseCompanionForPrimary('requests', 'requests', registry)).toBe(true);
    expect(shouldCloseCompanionForPrimary('notes', 'pulses', registry)).toBe(false);
  });
});
