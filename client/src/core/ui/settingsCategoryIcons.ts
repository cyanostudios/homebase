/**
 * Canonical Lucide icons for plugin settings category cards.
 * Keep DetailSection text-only when these cards are present (no duplicate icons).
 */
import {
  BookOpen,
  Image,
  LayoutGrid,
  Settings2,
  Tag,
  Timer,
  Upload,
  type LucideIcon,
} from 'lucide-react';

export const SETTINGS_CATEGORY_ICONS = {
  view: LayoutGrid,
  import: Upload,
  appearance: Image,
  tags: Tag,
  categories: Tag,
  api: Settings2,
  production: Timer,
  sources: BookOpen,
} as const satisfies Record<string, LucideIcon>;

export type SettingsCategoryIconId = keyof typeof SETTINGS_CATEGORY_ICONS;
