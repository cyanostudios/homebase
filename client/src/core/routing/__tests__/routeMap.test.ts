import { pathToNavPage } from '@/core/routing/routeMap';

describe('pathToNavPage', () => {
  it('maps root to dashboard', () => {
    expect(pathToNavPage('/')).toBe('dashboard');
    expect(pathToNavPage('/dashboard')).toBe('dashboard');
  });

  it('maps plugin routes', () => {
    expect(pathToNavPage('/contacts')).toBe('contacts');
    expect(pathToNavPage('/cups/')).toBe('cups');
  });

  it('maps legacy invoices sub-routes to the invoices list', () => {
    expect(pathToNavPage('/invoices/recurring')).toBe('invoices');
    expect(pathToNavPage('/invoices/payments')).toBe('invoices');
    expect(pathToNavPage('/invoices/reports')).toBe('invoices');
  });

  it('maps numeric invoice id as invoices page', () => {
    expect(pathToNavPage('/invoices/42')).toBe('invoices');
  });

  it('maps clubdesk sub-routes without colliding with guide slugs', () => {
    expect(pathToNavPage('/clubdesk/price-list')).toBe('clubdesk-price-list');
    expect(pathToNavPage('/clubdesk/price-list/beer')).toBe('clubdesk-price-list');
    expect(pathToNavPage('/clubdesk/info')).toBe('clubdesk-info');
  });

  it('maps clubdesk list and guide slug to Guides tab', () => {
    expect(pathToNavPage('/clubdesk')).toBe('clubdesk-guides');
    expect(pathToNavPage('/clubdesk/opening-checklist')).toBe('clubdesk-guides');
  });

  it('maps garments sub-routes without colliding with list slugs', () => {
    expect(pathToNavPage('/garments/inventory')).toBe('garments-inventory');
    expect(pathToNavPage('/garments/settings')).toBe('garments-lists');
  });

  it('maps garments list and list slug to Lists tab', () => {
    expect(pathToNavPage('/garments')).toBe('garments-lists');
    expect(pathToNavPage('/garments/u15-home')).toBe('garments-lists');
  });

  it('maps settings', () => {
    expect(pathToNavPage('/settings')).toBe('settings');
  });
});
