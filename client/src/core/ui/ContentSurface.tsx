import React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ContentSurfaceProps {
  children: React.ReactNode;
  className?: string;
  /** No p-4/md:p-6 on the card (detail panel fills the surface edge-to-edge inside the border). */
  flush?: boolean;
}

export function ContentSurface({ children, className, flush = false }: ContentSurfaceProps) {
  return (
    <div
      className={cn('relative m-2 flex h-full min-h-0 min-w-0 w-full flex-col md:m-4', className)}
    >
      <Card
        className={cn(
          'relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border-0 bg-card shadow-none',
          flush ? 'p-0' : 'p-4 md:p-6',
        )}
      >
        {children}
      </Card>
    </div>
  );
}
