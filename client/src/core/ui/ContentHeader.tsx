import { LucideIcon } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';

interface ContentHeaderProps {
  title: string;
  icon?: LucideIcon;
  /** Rendered next to the title (e.g. status badge for Mail/Pulse). */
  titleSuffix?: React.ReactNode;
  actionLabel?: string;
  actionIcon?: LucideIcon;
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
      <div className="flex items-center gap-2 flex-wrap">
        {trailing}
        {actionLabel && onAction && (
          <Button
            onClick={onAction}
            variant="secondary"
            size="sm"
            icon={ActionIcon}
            className={
              actionVariant === 'primary'
                ? 'h-9 text-xs px-3 w-full md:w-auto bg-green-600 hover:bg-green-700 text-white border-none'
                : 'h-9 text-xs px-3 w-full md:w-auto'
            }
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
