import { cn } from '@/lib/utils';

export function getNavItemButtonClass(isActive: boolean): string {
  return cn(
    'group w-full flex items-center gap-3 rounded-md px-3 py-2 text-[14px] transition-colors',
    'justify-start h-auto',
    isActive
      ? 'bg-primary/10 text-primary font-semibold hover:bg-primary/10 hover:text-primary'
      : 'text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary',
  );
}

export function getNavItemIconClass(isActive: boolean): string {
  return cn(
    'h-4 w-4 flex-shrink-0 transition-colors',
    isActive
      ? 'text-primary/70 group-hover:text-primary/70'
      : 'text-slate-400 dark:text-slate-500 group-hover:text-primary/70',
  );
}

export function getNavItemLabelClass(isActive: boolean): string {
  return cn('truncate', isActive ? 'font-medium' : '');
}
