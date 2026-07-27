import { ExternalLink } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export type ContactAssignmentBadge = {
  label: string;
  className?: string;
};

/** Row layout aligned with teams `ResponsibleRow` (avatar, name, badges, action). */
export function ContactAssignmentRow({
  title,
  badges = [],
  meta,
  actionLabel,
  onOpen,
  onTitleClick,
}: {
  title: string;
  badges?: ContactAssignmentBadge[];
  meta?: React.ReactNode;
  actionLabel: string;
  /** Primary action button (e.g. navigate to contact). */
  onOpen: () => void;
  /** Optional: avatar/name click (e.g. open quick-info popup). Defaults to onOpen. */
  onTitleClick?: () => void;
}) {
  const handleTitleClick = onTitleClick ?? onOpen;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5">
      <button
        type="button"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
        onClick={handleTitleClick}
        title={title}
      >
        {getInitials(title) || '?'}
      </button>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          className="truncate text-sm font-semibold hover:text-plugin hover:underline"
          onClick={handleTitleClick}
        >
          {title}
        </button>
        {badges.map((badge) => (
          <span
            key={`${badge.label}-${badge.className ?? ''}`}
            className={cn(
              'inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
              badge.className ??
                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
            )}
          >
            {badge.label}
          </span>
        ))}
        {meta}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={ExternalLink}
        className="h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={onOpen}
      >
        {actionLabel}
      </Button>
    </div>
  );
}
