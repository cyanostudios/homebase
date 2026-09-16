/**
 * Canonical Lucide icons for plugin settings category cards.
 * Keep DetailSection text-only when these cards are present (no duplicate icons).
 */
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  Columns3,
  Hash,
  Image,
  LayoutGrid,
  Route,
  Settings2,
  Share2,
  Sparkles,
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
  /** AI / mail / pulse provider routing — global default */
  routingGlobal: Sparkles,
  /** AI / mail / pulse provider routing — per-plugin overrides */
  routingPlugins: Route,
  /** Mail / pulse send history — all entries */
  historyAll: LayoutGrid,
  /** Mail / pulse send history — entries with plugin source */
  historyWithSource: Share2,
  /** Pulse send history — failed deliveries */
  historyFailed: AlertCircle,
  /** Mail / pulse send history — sent today */
  historyToday: CalendarDays,
} as const satisfies Record<string, LucideIcon>;

export type SettingsCategoryIconId = keyof typeof SETTINGS_CATEGORY_ICONS;
