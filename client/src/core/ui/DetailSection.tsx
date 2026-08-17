import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { AppIcon } from '@/types/icons';

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
  | 'garments'
  | 'ingest'
  | 'guides'
  | 'instructions'
  | 'clubdesk'
  | 'requests'
  | 'teams'
  | 'ai-providers'
  | 'pulses'
  | 'mail';

interface DetailSectionProps {
  title: string | React.ReactNode;
  icon?: AppIcon;
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
  /** When true, header toggles content visibility (same pattern as DetailActivityLog). */
  collapsible?: boolean;
  /** Initial open state when collapsible. Default false (collapsed). */
  defaultOpen?: boolean;
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
  collapsible = false,
  defaultOpen = false,
}: DetailSectionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  const iconColorClass =
    iconPlugin !== undefined && iconPlugin !== null
      ? `plugin-${iconPlugin} text-plugin`
      : 'text-muted-foreground';

  const titleNode = (
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
  );

  const iconNode =
    Icon &&
    (subtleTitle ? (
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
    ) : (
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80',
          iconColorClass,
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
    ));

  if (!collapsible) {
    return (
      <section className={cn('space-y-3', className)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {iconNode}
            {titleNode}
          </div>
          {action}
        </div>
        {children}
      </section>
    );
  }

  return (
    <section className={cn(className)}>
      <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={open}
              aria-label={
                open
                  ? t('common.collapseSection', 'Collapse section')
                  : t('common.expandSection', 'Expand section')
              }
            >
              {open ? (
                <ChevronDown
                  className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
                  aria-hidden
                />
              ) : (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
                  aria-hidden
                />
              )}
              {iconNode}
              {titleNode}
            </button>
          </CollapsibleTrigger>
          {action ? (
            <div
              className="shrink-0"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {action}
            </div>
          ) : null}
        </div>
        <CollapsibleContent>{children}</CollapsibleContent>
      </Collapsible>
    </section>
  );
}
