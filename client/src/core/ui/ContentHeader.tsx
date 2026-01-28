import { LucideIcon } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';

interface ContentHeaderProps {
  title: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  trailing?: React.ReactNode;
}

export function ContentHeader({
  title,
  icon: Icon,
  actionLabel,
  onAction,
  trailing,
}: ContentHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />}
        <h1 className="text-lg md:text-xl font-semibold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {trailing}
        {actionLabel && onAction && (
          <Button onClick={onAction} className="w-full md:w-auto">
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
