import type { AppIcon } from '@/types/icons';
import React from 'react';

import { Button } from '@/components/ui/button';

interface ContentHeaderProps {
  title: string;
  icon?: AppIcon;
  /** Rendered next to the title (e.g. status badge for Mail/Pulse). */
  titleSuffix?: React.ReactNode;
  actionLabel?: string;
  actionIcon?: AppIcon;
  /** When 'secondary', action button is grey (e.g. Close). Default 'primary' (green). */
  actionVariant?: 'primary' | 'secondary';
  onAction?: () => void;
  trailing?: React.ReactNode;
}

export function ContentHeader({
  title,
  icon: Icon,
  titleSuffix,
  actionLabel,
  actionIcon: ActionIcon,
  actionVariant = 'primary',
  onAction,
  trailing,
}: ContentHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {Icon && <Icon className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />}
        <h1 className="text-lg md:text-xl font-semibold text-foreground">{title}</h1>
        {titleSuffix}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
        {trailing}
        {actionLabel && onAction && (
          <Button
            onClick={onAction}
            variant="secondary"
            size="sm"
            icon={ActionIcon}
            className={
              actionVariant === 'primary'
                ? 'h-9 w-full flex-1 px-3 text-xs border-none bg-green-600 text-white hover:bg-green-700 md:w-auto md:flex-initial'
                : 'h-9 w-full flex-1 px-3 text-xs md:w-auto md:flex-initial'
            }
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
