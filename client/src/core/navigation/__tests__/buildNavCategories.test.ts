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
    const sport = categories.find((c) => c.id === 'Sport');
    expect(main?.items.map((i) => i.page)).toEqual(['dashboard', 'contacts']);
    expect(sport?.items.map((i) => i.page)).toEqual(['cups']);
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
});
