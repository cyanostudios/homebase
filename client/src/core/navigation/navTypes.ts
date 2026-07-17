import type { AppIcon } from '@/types/icons';

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
  | 'slots'
  | 'cups'
  | 'files'
  | 'ingest'
  | 'guides'
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
  badge?: {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  submenu?: SubmenuNavItem[];
};

export type NavCategory = {
  /** Stable category id (e.g. 'Main', 'Sport') — used for collapsible state keys. */
  id: string;
  /** Translated display title. */
  title: string;
  items: NavItemData[];
};

export type NavTranslate = (key: string) => string;
