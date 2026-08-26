import React from 'react';

import { cn } from '@/lib/utils';

import { DIALOG_TITLE_CLASS } from './dialogStyles';

type DialogHeadingProps = {
  className?: string;
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3';
};

export function DialogHeading({ className, children, as: Component = 'h2' }: DialogHeadingProps) {
  return <Component className={cn(DIALOG_TITLE_CLASS, className)}>{children}</Component>;
}
