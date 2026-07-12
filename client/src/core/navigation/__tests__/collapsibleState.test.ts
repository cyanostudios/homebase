import {
  findActiveCategoryId,
  findSubmenuParentPage,
  isSubmenuOpen,
} from '@/core/navigation/collapsibleState';
import type { NavCategory, NavItemData, NavPage } from '@/core/navigation/navTypes';

const invoicesItem: NavItemData = {
  label: 'Invoices',
  icon: (() => null) as NavItemData['icon'],
  page: 'invoices',
  order: 0,
  submenu: [
    {
      label: 'Recurring',
      icon: (() => null) as NavItemData['icon'],
      page: 'invoices-recurring',
      order: 1,
    },
  ],
};

const navCategories: NavCategory[] = [
  {
    id: 'Business',
    title: 'Business',
    items: [invoicesItem],
  },
];

describe('collapsibleState', () => {
  describe('findActiveCategoryId', () => {
    it('returns category id for a top-level page', () => {
      expect(findActiveCategoryId(navCategories, 'invoices')).toBe('Business');
    });

    it('returns category id for a submenu page', () => {
      expect(findActiveCategoryId(navCategories, 'invoices-recurring')).toBe('Business');
    });

    it('returns null when page is not in nav', () => {
      expect(findActiveCategoryId(navCategories, 'dashboard')).toBeNull();
    });
  });

  describe('findSubmenuParentPage', () => {
    it('returns parent page for submenu route', () => {
      expect(findSubmenuParentPage(navCategories, 'invoices-recurring')).toBe('invoices');
    });

    it('returns null for non-submenu route', () => {
      expect(findSubmenuParentPage(navCategories, 'invoices')).toBeNull();
    });
  });

  describe('isSubmenuOpen', () => {
    it('auto-opens when current page is a submenu item', () => {
      expect(isSubmenuOpen(invoicesItem, 'invoices-recurring', new Set(), new Set())).toBe(true);
    });

    it('respects userClosedSubmenus (decision A)', () => {
      const closed = new Set<NavPage>(['invoices']);
      expect(isSubmenuOpen(invoicesItem, 'invoices-recurring', new Set(), closed)).toBe(false);
    });

    it('opens when user manually opened', () => {
      const opened = new Set<NavPage>(['invoices']);
      expect(isSubmenuOpen(invoicesItem, 'contacts', opened, new Set())).toBe(true);
    });

    it('returns false when item has no submenu', () => {
      const item: NavItemData = { ...invoicesItem, submenu: undefined };
      expect(isSubmenuOpen(item, 'invoices', new Set(), new Set())).toBe(false);
    });
  });
});
