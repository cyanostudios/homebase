import React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface SettingsCategoryCardProps {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /**
   * @deprecated Unused — colored dots were replaced by the category icon
   * (same style as DetailSection subtleTitle / Contact Properties).
   */
  dotClassName?: string;
  active?: boolean;
  onSelect?: () => void;
}

/**
 * Category picker card used by Core Settings and plugin settings shells.
 * Label row matches DetailSection `subtleTitle` (icon + uppercase heading);
 * description sits underneath. Same surface language as ListFilterStatCard.
 */
export function SettingsCategoryCard({
  label,
  description,
  icon: Icon,
  active = false,
  onSelect,
}: SettingsCategoryCardProps) {
  return (
    <Card
      className={cn(
        'group rounded-xl border-0 bg-card px-6 py-4 shadow-sm transition-colors',
        'cursor-pointer hover:bg-primary/10 hover:text-primary',
        active && 'bg-primary/10 text-primary ring-1 ring-border/70',
      )}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={() => {
        if (!active) {
          onSelect?.();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (!active) {
            onSelect?.();
          }
        }
      }}
    >
      <div
        className={cn(
          'flex min-w-0 items-center gap-2 transition-colors group-hover:text-primary',
          active ? 'text-primary' : 'text-slate-500 dark:text-slate-400',
        )}
      >
        <Icon
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-colors group-hover:text-primary',
            active ? 'text-primary' : 'text-slate-400 dark:text-slate-500',
          )}
          aria-hidden
        />
        <span className="truncate text-xs font-bold uppercase leading-none tracking-[0.1em]">
          {label}
        </span>
      </div>
      <p className={cn('mt-2 text-sm', active ? 'text-primary/80' : 'text-muted-foreground')}>
        {description}
      </p>
    </Card>
  );
}
