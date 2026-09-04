import {
  findActiveCategoryId,
  findSubmenuParentPage,
  isSubmenuOpen,
} from '@/core/navigation/collapsibleState';
import type { NavCategory, NavItemData, NavPage } from '@/core/navigation/navTypes';

const clubdeskItem: NavItemData = {
  label: 'Clubdesk',
  icon: (() => null) as NavItemData['icon'],
  page: 'clubdesk',
  order: 0,
  submenu: [
    {
      label: 'Price list',
      icon: (() => null) as NavItemData['icon'],
      page: 'clubdesk-price-list',
      order: 1,
    },
  ],
};

const navCategories: NavCategory[] = [
  {
    id: 'Apps',
    title: 'Apps',
    icon: (() => null) as NavCategory['icon'],
    items: [clubdeskItem],
  },
];

describe('collapsibleState', () => {
  describe('findActiveCategoryId', () => {
    it('returns category id for a top-level page', () => {
      expect(findActiveCategoryId(navCategories, 'clubdesk')).toBe('Apps');
    });

    it('returns category id for a submenu page', () => {
      expect(findActiveCategoryId(navCategories, 'clubdesk-price-list')).toBe('Apps');
    });

    it('returns null when page is not in nav', () => {
      expect(findActiveCategoryId(navCategories, 'dashboard')).toBeNull();
    });
  });

  describe('findSubmenuParentPage', () => {
    it('returns parent page for submenu route', () => {
      expect(findSubmenuParentPage(navCategories, 'clubdesk-price-list')).toBe('clubdesk');
    });

    it('returns null for non-submenu route', () => {
      expect(findSubmenuParentPage(navCategories, 'clubdesk')).toBeNull();
    });
  });

  describe('isSubmenuOpen', () => {
    it('auto-opens when current page is a submenu item', () => {
      expect(isSubmenuOpen(clubdeskItem, 'clubdesk-price-list', new Set(), new Set())).toBe(true);
    });

    it('respects userClosedSubmenus (decision A)', () => {
      const closed = new Set<NavPage>(['clubdesk']);
      expect(isSubmenuOpen(clubdeskItem, 'clubdesk-price-list', new Set(), closed)).toBe(false);
    });

    it('opens when user manually opened', () => {
      const opened = new Set<NavPage>(['clubdesk']);
      expect(isSubmenuOpen(clubdeskItem, 'contacts', opened, new Set())).toBe(true);
    });

    it('returns false when item has no submenu', () => {
      const item: NavItemData = { ...clubdeskItem, submenu: undefined };
      expect(isSubmenuOpen(item, 'clubdesk', new Set(), new Set())).toBe(false);
    });
  });
});
