import {
  isGarmentsNavPage,
  isGarmentsSubRoute,
  resolveGarmentPanelClosePath,
} from '@/core/routing/garmentsRoutes';

describe('isGarmentsNavPage', () => {
  it('matches garments list and inventory nav pages', () => {
    expect(isGarmentsNavPage('garments')).toBe(true);
    expect(isGarmentsNavPage('garments-lists')).toBe(true);
    expect(isGarmentsNavPage('garments-inventory')).toBe(true);
    expect(isGarmentsNavPage('contacts')).toBe(false);
  });
});

describe('isGarmentsSubRoute', () => {
  it('recognizes the inventory sub-route', () => {
    expect(isGarmentsSubRoute('garments', 'inventory')).toBe(true);
  });

  it('does not treat list slugs as named sub-routes', () => {
    expect(isGarmentsSubRoute('garments', 'u15-home')).toBe(false);
    expect(isGarmentsSubRoute('garments', undefined)).toBe(false);
    expect(isGarmentsSubRoute('contacts', 'inventory')).toBe(false);
  });
});

describe('resolveGarmentPanelClosePath', () => {
  it('returns the lists index when closing a list item', () => {
    expect(resolveGarmentPanelClosePath('/garments/u15-home', { returnToInventory: false })).toBe(
      '/garments',
    );
  });

  it('does not overwrite sidebar navigation to inventory', () => {
    expect(
      resolveGarmentPanelClosePath('/garments/inventory', { returnToInventory: false }),
    ).toBeNull();
  });

  it('does not overwrite navigation to another plugin', () => {
    expect(resolveGarmentPanelClosePath('/contacts', { returnToInventory: false })).toBeNull();
  });

  it('stays on inventory when closing an inventory panel (no item URL)', () => {
    expect(
      resolveGarmentPanelClosePath('/garments/inventory', { returnToInventory: true }),
    ).toBeNull();
  });

  it('does not navigate when already on the lists index', () => {
    expect(resolveGarmentPanelClosePath('/garments', { returnToInventory: false })).toBeNull();
    expect(resolveGarmentPanelClosePath('/garments/', { returnToInventory: false })).toBeNull();
  });

  it('sends inventory-context close from a list item URL to inventory', () => {
    expect(resolveGarmentPanelClosePath('/garments/u15-home', { returnToInventory: true })).toBe(
      '/garments/inventory',
    );
  });
});
