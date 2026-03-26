import { LucideIcon } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

import { Heading } from './Typography';

export type DetailSectionIconPlugin =
  | 'notes'
  | 'contacts'
  | 'tasks'
  | 'estimates'
  | 'invoices'
  | 'files'
  | 'slots'
  | 'matches'
  | 'cups';

interface DetailSectionProps {
  title: string | React.ReactNode;
  icon?: LucideIcon;
  /** Plugin whose color to use for the icon (e.g. tasks = lila, notes = gul). Omit for neutral gray (e.g. Information). */
  iconPlugin?: DetailSectionIconPlugin;
  /** Optional node rendered to the right of the title (e.g. a reset button). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DetailSection({
  title,
  icon: Icon,
  iconPlugin,
  action,
  children,
  className,
}: DetailSectionProps) {
  const iconColorClass =
    iconPlugin !== undefined && iconPlugin !== null
      ? `plugin-${iconPlugin} text-plugin`
      : 'text-muted-foreground';

  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80',
                iconColorClass,
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
          <Heading level={3} className="text-sm font-semibold text-foreground truncate">
            {title}
          </Heading>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
