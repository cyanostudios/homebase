import React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Shared list + detail panel chrome (gray-blue surface, rounded, full height). */
export const MAIN_CONTENT_SHELL_CLASS =
  'flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border-0 bg-slate-100 dark:bg-slate-900';

interface ContentSurfaceProps {
  children: React.ReactNode;
  className?: string;
  /** No p-4/md:p-6 on the card (detail panel fills the surface edge-to-edge). */
  flush?: boolean;
}

export function ContentSurface({ children, className, flush = false }: ContentSurfaceProps) {
  return (
    <div className={cn('relative m-0 flex h-full min-h-0 min-w-0 w-full flex-col', className)}>
      <Card
        className={cn(
          'relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none',
          flush ? 'p-0' : 'p-4 md:p-6',
        )}
      >
        {children}
      </Card>
    </div>
  );
}
