import React from 'react';

import { cn } from '@/lib/utils';

import { Heading } from './Typography';

interface DetailSectionProps {
  title: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DetailSection({ title, children, className }: DetailSectionProps) {
  return (
    <section className={cn('space-y-3', className)}>
      <Heading level={3} className="text-sm font-semibold text-foreground">
        {title}
      </Heading>
      {children}
    </section>
  );
}
