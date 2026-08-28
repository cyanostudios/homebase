import { isClubdeskSubRoute, resolveClubdeskPanelClosePath } from '@/core/routing/clubdeskRoutes';

describe('isClubdeskSubRoute', () => {
  it('recognizes named clubdesk sub-routes', () => {
    expect(isClubdeskSubRoute('clubdesk', 'price-list')).toBe(true);
    expect(isClubdeskSubRoute('clubdesk', 'info')).toBe(true);
  });

  it('does not treat guide slugs as named sub-routes', () => {
    expect(isClubdeskSubRoute('clubdesk', 'opening-checklist')).toBe(false);
    expect(isClubdeskSubRoute('clubdesk', undefined)).toBe(false);
    expect(isClubdeskSubRoute('garments', 'price-list')).toBe(false);
  });
});

describe('resolveClubdeskPanelClosePath', () => {
  it('returns guides index when closing a guide item', () => {
    expect(resolveClubdeskPanelClosePath('/clubdesk/opening-checklist')).toBe('/clubdesk');
  });

  it('returns price-list index when closing a price-list item', () => {
    expect(resolveClubdeskPanelClosePath('/clubdesk/price-list/beer')).toBe('/clubdesk/price-list');
  });

  it('does not overwrite sidebar navigation to price-list', () => {
    expect(resolveClubdeskPanelClosePath('/clubdesk/price-list')).toBeNull();
  });

  it('does not overwrite navigation to info or another plugin', () => {
    expect(resolveClubdeskPanelClosePath('/clubdesk/info')).toBeNull();
    expect(resolveClubdeskPanelClosePath('/contacts')).toBeNull();
  });

  it('does not navigate when already on the guides index', () => {
    expect(resolveClubdeskPanelClosePath('/clubdesk')).toBeNull();
    expect(resolveClubdeskPanelClosePath('/clubdesk/')).toBeNull();
  });
});
