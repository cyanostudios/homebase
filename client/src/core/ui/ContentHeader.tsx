import { LucideIcon } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';

interface ContentHeaderProps {
  title: string;
  icon?: LucideIcon;
  /** Muted text or node beside the title (e.g. total count). */
  titleExtra?: React.ReactNode;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
  trailing?: React.ReactNode;
}

export function ContentHeader({
  title,
  icon: Icon,
  titleExtra,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  trailing,
}: ContentHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
        {Icon && <Icon className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground shrink-0" />}
        <h1 className="text-lg md:text-xl font-semibold text-foreground">{title}</h1>
        {titleExtra ? (
          <span className="text-sm text-muted-foreground font-normal tabular-nums">
            {titleExtra}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {trailing}
        {actionLabel && onAction && (
          <Button
            onClick={onAction}
            variant="secondary"
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white border-none"
          >
            {ActionIcon && <ActionIcon className="h-4 w-4" />}
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
