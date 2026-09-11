import { BUTTON_COLOR_TRANSITION_CLASS } from '@/components/ui/button';
import {
  LINK_BUTTON_FONT_CLASS,
  LINK_BUTTON_TEXT_IDLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

export function getNavItemButtonClass(isActive: boolean): string {
  return cn(
    'group w-full flex items-center gap-3 rounded-md px-3 py-2 text-base',
    BUTTON_COLOR_TRANSITION_CLASS,
    'justify-start h-auto hover:bg-transparent dark:hover:bg-transparent',
    LINK_BUTTON_FONT_CLASS,
    isActive
      ? 'text-primary hover:text-primary'
      : `${LINK_BUTTON_TEXT_IDLE_CLASS} hover:text-foreground`,
  );
}

export function getNavItemIconClass(isActive: boolean): string {
  return cn(
    'h-4 w-4 flex-shrink-0',
    BUTTON_COLOR_TRANSITION_CLASS,
    isActive ? 'text-primary' : 'text-slate-400 dark:text-slate-600 group-hover:text-foreground',
  );
}

export function getNavItemLabelClass(_isActive: boolean): string {
  return 'truncate';
}
