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
  widthPx = RIGHT_SIDEBAR_FLYOUT_WIDTH_PX,
  bodyClassName,
  className,
  titleClassName,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Override flyout width (companion uses a wider panel). */
  widthPx?: number;
  /** Override scroll-body padding (companion uses a tighter inset). */
  bodyClassName?: string;
  /** Override shell surface (companion uses slate gray, not card white). */
  className?: string;
  /** Override title scale (companion matches plugin list titles). */
  titleClassName?: string;
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
        open && widthPx > RIGHT_SIDEBAR_FLYOUT_WIDTH_PX ? 'z-40' : null,
        className,
      )}
      style={{ width: widthPx }}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-3">
        <h2 className={cn('truncate text-lg font-extrabold text-foreground', titleClassName)}>
          {displayTitle}
        </h2>
        <RoundIconLabelButton
          icon={X}
          label={t('common.close')}
          variant="secondary"
          size="xs"
          expandOnHover={false}
          onClick={onClose}
        />
      </div>
      <div className={cn('min-h-0 flex-1 overflow-y-auto px-3 pb-4', bodyClassName)}>
        {displayChildren}
      </div>
    </div>
  );
}
