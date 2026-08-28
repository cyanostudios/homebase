import { createElement } from 'react';

import { createPanelTitles } from '../PanelTitles';

describe('createPanelTitles — detail header menus in view mode', () => {
  const contact = { id: 42, companyName: 'Acme' };
  const quickActionsTitle = createElement('div', { 'data-testid': 'contacts-quick-actions' });

  const pluginContext = {
    getPanelTitle: (mode: string, item: unknown) => {
      if (mode === 'view' && item) {
        return quickActionsTitle;
      }
      return null;
    },
  };

  it('returns contacts getPanelTitle React node on desktop view', () => {
    const { getPanelTitle } = createPanelTitles(
      { name: 'contacts' },
      'view',
      contact,
      false,
      () => undefined,
      pluginContext,
    );
    expect(getPanelTitle()).toBe(quickActionsTitle);
  });

  it('returns contacts getPanelTitle React node on mobile view (not blanked)', () => {
    const { getPanelTitle } = createPanelTitles(
      { name: 'contacts' },
      'view',
      contact,
      true,
      () => undefined,
      pluginContext,
    );
    expect(getPanelTitle()).toBe(quickActionsTitle);
  });

  it('returns tasks getPanelTitle React node on mobile view when provided', () => {
    const taskMenus = createElement('div', { 'data-testid': 'tasks-header-menus' });
    const { getPanelTitle } = createPanelTitles(
      { name: 'tasks' },
      'view',
      { id: 1, title: 'Task' },
      true,
      () => undefined,
      {
        getPanelTitle: (mode: string, item: unknown) =>
          mode === 'view' && item ? taskMenus : null,
      },
    );
    expect(getPanelTitle()).toBe(taskMenus);
  });

  it('still blanks other plugins on mobile view when getPanelTitle is absent', () => {
    const { getPanelTitle } = createPanelTitles(
      { name: 'tasks' },
      'view',
      { id: 1, title: 'Task' },
      true,
      () => undefined,
      {},
    );
    expect(getPanelTitle()).toBe('');
  });
});
