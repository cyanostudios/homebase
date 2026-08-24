import type { AppIcon } from '@/types/icons';

export type NavBadge = {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
};

export type NavPage =
  | 'dashboard'
  | 'contacts'
  | 'notes'
  | 'estimates'
  | 'invoices'
  | 'invoices-recurring'
  | 'invoices-payments'
  | 'invoices-reports'
  | 'tasks'
  | 'requests'
  | 'teams'
  | 'schedule'
  | 'matches'
  | 'garments'
  | 'garments-lists'
  | 'garments-inventory'
  | 'slots'
  | 'cups'
  | 'files'
  | 'ingest'
  | 'guides'
  | 'instructions'
  | 'clubdesk'
  | 'clubdesk-guides'
  | 'clubdesk-price-list'
  | 'clubdesk-info'
  | 'mail'
  | 'pulses'
  | 'ai-providers'
  | 'settings';

export type SubmenuNavItem = {
  label: string;
  icon: AppIcon;
  page: NavPage;
  order: number;
};

export type NavItemData = {
  label: string;
  icon: AppIcon;
  page: NavPage;
  order: number;
  badge?: NavBadge;
  submenu?: SubmenuNavItem[];
};

export type NavCategory = {
  /** Stable category id (e.g. 'Main', 'Sport') — used for collapsible state keys. */
  id: string;
  /** Translated display title. */
  title: string;
  /** Section icon — matches DetailSection subtleTitle (e.g. Contact Properties). */
  icon: AppIcon;
  items: NavItemData[];
};

export type NavTranslate = (key: string) => string;
