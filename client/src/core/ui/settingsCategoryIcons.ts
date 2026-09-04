/**
 * Canonical Lucide icons for plugin settings category cards.
 * Keep DetailSection text-only when these cards are present (no duplicate icons).
 */
import {
  BookOpen,
  Columns3,
  Hash,
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
  columns: Columns3,
  import: Upload,
  appearance: Image,
  tags: Tag,
  categories: Tag,
  api: Settings2,
  production: Timer,
  sources: BookOpen,
  numbering: Hash,
} as const satisfies Record<string, LucideIcon>;

export type SettingsCategoryIconId = keyof typeof SETTINGS_CATEGORY_ICONS;
