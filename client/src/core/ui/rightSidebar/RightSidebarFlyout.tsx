import { X } from 'lucide-react';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { RIGHT_SIDEBAR_FLYOUT_WIDTH_PX } from '@/core/ui/RightSidebarContext';
import { cn } from '@/lib/utils';

/** Keep in sync with `duration-200` on the flyout shell. */
export const RIGHT_SIDEBAR_FLYOUT_ANIMATION_MS = 200;

export function RightSidebarFlyout({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const cachedTitleRef = useRef(title);
  const cachedChildrenRef = useRef(children);

  // Retain last open content so the close slide is not an empty shell.
  if (open) {
    if (title) {
      cachedTitleRef.current = title;
    }
    if (children != null) {
      cachedChildrenRef.current = children;
    }
  }

  const displayTitle = open && title ? title : cachedTitleRef.current;
  const displayChildren = open && children != null ? children : cachedChildrenRef.current;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={displayTitle || title}
      aria-hidden={!open}
      className={cn(
        'absolute top-0 right-full z-30 flex h-full flex-col bg-card shadow-xl',
        'transition-[transform,opacity] duration-200 ease-in-out',
        // Closed: slide under the rail — keep opacity 0 so icons stay visible (clicks already pass through).
        open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0',
      )}
      style={{ width: RIGHT_SIDEBAR_FLYOUT_WIDTH_PX }}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-3">
        <h2 className="truncate text-lg font-extrabold text-foreground">{displayTitle}</h2>
        <RoundIconLabelButton
          icon={X}
          label={t('common.close')}
          variant="secondary"
          size="xs"
          expandOnHover={false}
          onClick={onClose}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">{displayChildren}</div>
    </div>
  );
}
