import {
  LINK_BUTTON_FONT_CLASS,
  LINK_BUTTON_TEXT_ACTIVE_CLASS,
  LINK_BUTTON_TEXT_IDLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

export function getNavItemButtonClass(isActive: boolean): string {
  return cn(
    'group w-full flex items-center gap-3 rounded-md px-3 py-2 text-base transition-colors',
    'justify-start h-auto',
    isActive
      ? `${LINK_BUTTON_TEXT_ACTIVE_CLASS} ${LINK_BUTTON_FONT_CLASS} hover:text-foreground`
      : `${LINK_BUTTON_TEXT_IDLE_CLASS} ${LINK_BUTTON_FONT_CLASS} hover:text-foreground`,
  );
}

export function getNavItemIconClass(isActive: boolean): string {
  return cn(
    'h-4 w-4 flex-shrink-0 transition-colors',
    isActive
      ? LINK_BUTTON_TEXT_ACTIVE_CLASS
      : 'text-slate-400 dark:text-slate-600 group-hover:text-foreground',
  );
}

export function getNavItemLabelClass(_isActive: boolean): string {
  return 'truncate';
}
