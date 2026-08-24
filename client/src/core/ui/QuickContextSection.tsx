import React from 'react';

import { cn } from '@/lib/utils';
import type { AppIcon } from '@/types/icons';

import { DetailSection, type DetailSectionIconPlugin } from './DetailSection';

/** Section heading in list quick-context sidebars — matches DetailSection + subtleTitle (e.g. Contact Properties). */
export function QuickContextSection({
  title,
  icon,
  iconPlugin,
  children,
  className,
}: {
  title: string;
  icon?: AppIcon;
  iconPlugin?: DetailSectionIconPlugin;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DetailSection
      title={title}
      icon={icon}
      iconPlugin={iconPlugin}
      subtleTitle
      className={cn(className)}
    >
      {children}
    </DetailSection>
  );
}
