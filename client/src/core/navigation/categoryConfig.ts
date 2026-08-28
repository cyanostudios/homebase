import {
  AppWindow,
  Briefcase,
  FlaskConical,
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
  { id: 'Sport', i18nKey: 'sport', icon: Trophy },
  { id: 'Business', i18nKey: 'business', icon: Briefcase },
  { id: 'E-commerce', i18nKey: 'ecommerce', icon: ShoppingCart },
  { id: 'Tools', i18nKey: 'tools', icon: Wrench },
  { id: 'Apps', i18nKey: 'apps', icon: AppWindow },
  { id: 'Account', i18nKey: 'account', icon: User },
  { id: 'Beta', i18nKey: 'beta', icon: FlaskConical },
] as const satisfies ReadonlyArray<{
  id: string;
  i18nKey: string;
  icon: AppIcon;
}>;

export type NavCategoryId = (typeof NAV_CATEGORIES)[number]['id'];
