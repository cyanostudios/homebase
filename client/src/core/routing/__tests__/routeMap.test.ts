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

  it('maps invoices sub-routes without colliding with item ids', () => {
    expect(pathToNavPage('/invoices/recurring')).toBe('invoices-recurring');
    expect(pathToNavPage('/invoices/payments')).toBe('invoices-payments');
    expect(pathToNavPage('/invoices/reports')).toBe('invoices-reports');
  });

  it('maps numeric invoice id as invoices page', () => {
    expect(pathToNavPage('/invoices/42')).toBe('invoices');
  });

  it('maps clubdesk sub-routes without colliding with guide slugs', () => {
    expect(pathToNavPage('/clubdesk/price-list')).toBe('clubdesk-price-list');
    expect(pathToNavPage('/clubdesk/price-list/beer')).toBe('clubdesk-price-list');
  });

  it('maps clubdesk list and guide slug to Guides tab', () => {
    expect(pathToNavPage('/clubdesk')).toBe('clubdesk-guides');
    expect(pathToNavPage('/clubdesk/opening-checklist')).toBe('clubdesk-guides');
  });

  it('maps settings', () => {
    expect(pathToNavPage('/settings')).toBe('settings');
  });
});
