import {
  Briefcase,
  CalendarDays,
  FileText,
  Home,
  ShoppingCart,
  Trophy,
  User,
  Wrench,
} from 'lucide-react';

import type { AppIcon } from '@/types/icons';

/** Sidebar category order, i18n keys, and section icons — single source of truth. */
export const NAV_CATEGORIES = [
  { id: 'Main', i18nKey: 'main', icon: Home },
  { id: 'Content', i18nKey: 'content', icon: FileText },
  { id: 'Sport', i18nKey: 'sport', icon: Trophy },
  { id: 'Booking', i18nKey: 'booking', icon: CalendarDays },
  { id: 'Business', i18nKey: 'business', icon: Briefcase },
  { id: 'E-commerce', i18nKey: 'ecommerce', icon: ShoppingCart },
  { id: 'Tools', i18nKey: 'tools', icon: Wrench },
  { id: 'Account', i18nKey: 'account', icon: User },
] as const satisfies ReadonlyArray<{
  id: string;
  i18nKey: string;
  icon: AppIcon;
}>;

export type NavCategoryId = (typeof NAV_CATEGORIES)[number]['id'];
