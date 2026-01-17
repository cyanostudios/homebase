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
        'relative z-30 h-full w-full m-4 p-6 rounded-2xl shadow-lg flex flex-col',
        className,
      )}
    >
      {children}
    </Card>
  );
}
