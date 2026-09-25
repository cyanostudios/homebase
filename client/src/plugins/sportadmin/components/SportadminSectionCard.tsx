// client/src/plugins/sportadmin/components/SportadminSectionCard.tsx
import React from 'react';

import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import type { AppIcon } from '@/types/icons';

/** Platform settings chrome: DETAIL_VIEW card + subtleTitle DetailSection. */
export function SportadminSectionCard({
  title,
  icon,
  action,
  collapsible = false,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: AppIcon;
  action?: React.ReactNode;
  /** Collapsible header; defaultOpen false = closed by default. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={title}
        icon={icon}
        subtleTitle
        className="p-4 sm:p-6"
        action={action}
        collapsible={collapsible}
        defaultOpen={defaultOpen}
      >
        {children}
      </DetailSection>
    </Card>
  );
}
