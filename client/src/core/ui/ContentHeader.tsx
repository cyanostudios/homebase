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
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {trailing}
        {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
      </div>
    </div>
  );
}
