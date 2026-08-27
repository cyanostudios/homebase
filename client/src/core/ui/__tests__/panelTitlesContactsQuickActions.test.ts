import { createElement } from 'react';

import { createPanelTitles } from '../PanelTitles';

describe('createPanelTitles — contacts view Quick Actions', () => {
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

  it('returns contacts getPanelTitle on desktop view', () => {
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

  it('returns contacts getPanelTitle on mobile view (not blanked)', () => {
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

  it('still blanks other plugins on mobile view', () => {
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
