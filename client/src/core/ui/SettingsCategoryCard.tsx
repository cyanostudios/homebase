import React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface SettingsCategoryCardProps {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  dotClassName: string;
  active?: boolean;
  onSelect?: () => void;
}

/**
 * Category picker card used by Core Settings and plugin settings shells.
 * Same surface language as ListFilterStatCard, with a short description under the label.
 */
export function SettingsCategoryCard({
  label,
  description,
  icon: Icon,
  dotClassName,
  active = false,
  onSelect,
}: SettingsCategoryCardProps) {
  return (
    <Card
      className={cn(
        'group rounded-xl border-0 bg-card px-6 py-4 shadow-sm transition-colors',
        'cursor-pointer hover:bg-primary/10 hover:text-primary',
        active && 'ring-1 ring-border/70',
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
      <div className="flex items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 transition-colors group-hover:text-primary dark:text-slate-500">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClassName)} aria-hidden />
          <span className="truncate">{label}</span>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}
