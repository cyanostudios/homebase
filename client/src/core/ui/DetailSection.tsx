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
  | 'ingest';

interface DetailSectionProps {
  title: string | React.ReactNode;
  icon?: LucideIcon;
  /** Plugin whose color to use for the icon (e.g. tasks = lila, notes = gul). Omit for neutral gray (e.g. Information). */
  iconPlugin?: DetailSectionIconPlugin;
  /** Optional node rendered to the right of the title (e.g. a reset button). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Match slot detail headline: larger title (text-2xl) for main entity title rows. */
  prominentTitle?: boolean;
  /** Render the section title as a small uppercase category label (11px, bold, 0.1em tracking) per hb-section-title pattern. */
  subtleTitle?: boolean;
}

export function DetailSection({
  title,
  icon: Icon,
  iconPlugin,
  action,
  children,
  className,
  prominentTitle = false,
  subtleTitle = false,
}: DetailSectionProps) {
  const iconColorClass =
    iconPlugin !== undefined && iconPlugin !== null
      ? `plugin-${iconPlugin} text-plugin`
      : 'text-muted-foreground';

  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon &&
            (subtleTitle ? (
              <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
            ) : (
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80',
                  iconColorClass,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
            ))}
          <Heading
            level={3}
            size={prominentTitle ? '2xl' : subtleTitle ? 'xs' : 'sm'}
            className={cn(
              'truncate',
              subtleTitle
                ? 'uppercase tracking-[0.1em] font-bold text-slate-500 dark:text-slate-400'
                : 'font-semibold text-foreground',
            )}
          >
            {title}
          </Heading>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
