import { buildNavCategories } from '@/core/navigation/buildNavCategories';

const t = (key: string) => key;

describe('buildNavCategories', () => {
  it('includes dashboard in Main when no plugins enabled', () => {
    const categories = buildNavCategories(new Set(), t);
    expect(categories).toHaveLength(1);
    expect(categories[0].id).toBe('Main');
    expect(categories[0].items[0].page).toBe('dashboard');
  });

  it('includes enabled plugins in correct categories', () => {
    const categories = buildNavCategories(new Set(['contacts', 'cups']), t);
    const main = categories.find((c) => c.id === 'Main');
    const apps = categories.find((c) => c.id === 'Apps');
    expect(main?.items.map((i) => i.page)).toEqual(['dashboard', 'contacts']);
    expect(apps?.items.map((i) => i.page)).toEqual(['cups']);
  });

  it('sorts items by order within a category', () => {
    const categories = buildNavCategories(new Set(['contacts', 'notes', 'tasks']), t);
    const main = categories.find((c) => c.id === 'Main');
    expect(main?.items.map((i) => i.page)).toEqual(['dashboard', 'contacts', 'notes', 'tasks']);
  });

  it('sorts submenu items by order', () => {
    const categories = buildNavCategories(new Set(['invoices']), t);
    const business = categories.find((c) => c.id === 'Business');
    const invoices = business?.items.find((i) => i.page === 'invoices');
    expect(invoices?.submenu?.map((s) => s.page)).toEqual([
      'invoices',
      'invoices-recurring',
      'invoices-payments',
      'invoices-reports',
    ]);
  });

  it('omits empty categories', () => {
    const categories = buildNavCategories(new Set(['contacts']), t);
    expect(categories.some((c) => c.id === 'Sport')).toBe(false);
  });

  it('uses stable category ids and translated titles', () => {
    const categories = buildNavCategories(new Set(['contacts']), t);
    expect(categories[0].id).toBe('Main');
    expect(categories[0].title).toBe('nav.main');
  });

  it('places Beta last with guides and instructions', () => {
    const categories = buildNavCategories(new Set(['contacts', 'guides', 'instructions']), t);
    expect(categories[categories.length - 1].id).toBe('Beta');
    expect(categories[categories.length - 1].items.map((i) => i.page)).toEqual([
      'guides',
      'instructions',
    ]);
    expect(categories.some((c) => c.id === 'Content')).toBe(false);
  });

  it('puts clubdesk and cups in Apps (after Tools), requests in Main, slots in Beta', () => {
    const categories = buildNavCategories(
      new Set(['clubdesk', 'cups', 'requests', 'teams', 'slots', 'files']),
      t,
    );
    expect(categories.some((c) => c.id === 'Content')).toBe(false);
    expect(categories.some((c) => c.id === 'Booking')).toBe(false);
    const ids = categories.map((c) => c.id);
    expect(ids.indexOf('Tools')).toBeLessThan(ids.indexOf('Apps'));
    expect(categories.find((c) => c.id === 'Apps')?.items.map((i) => i.page)).toEqual([
      'cups',
      'clubdesk',
    ]);
    expect(categories.find((c) => c.id === 'Sport')?.items.map((i) => i.page)).toEqual(['teams']);
    expect(categories.find((c) => c.id === 'Main')?.items.map((i) => i.page)).toEqual([
      'dashboard',
      'requests',
    ]);
    expect(categories.find((c) => c.id === 'Beta')?.items.map((i) => i.page)).toEqual(['slots']);
  });
});
