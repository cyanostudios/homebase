import React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ContentSurfaceProps {
  children: React.ReactNode;
  className?: string;
}

export function ContentSurface({ children, className }: ContentSurfaceProps) {
  return (
    <Card
      className={cn(
        'relative h-full min-h-0 w-full m-2 md:m-4 p-4 md:p-6 rounded-2xl shadow-lg flex flex-col overflow-hidden',
        className,
      )}
    >
      {children}
    </Card>
  );
}
