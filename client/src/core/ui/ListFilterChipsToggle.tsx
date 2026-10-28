import { ListFilter } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** On (chips visible): white surface. */
export const LIST_FILTER_CHIPS_TOGGLE_CLASS =
  'gap-1.5 border-0 bg-white px-3.5 text-sm font-extrabold text-primary shadow-sm hover:bg-primary hover:text-primary-foreground dark:bg-white dark:text-primary dark:hover:bg-primary dark:hover:text-primary-foreground';

/** Off (chips hidden): same soft primary chrome as Sort / Select. */
export const LIST_FILTER_CHIPS_TOGGLE_OFF_CLASS =
  'gap-1.5 border-0 bg-primary/10 px-3.5 text-sm font-extrabold text-primary shadow-none hover:bg-primary hover:text-primary-foreground';

/**
 * Active-selection pip on a rounded-full control.
 * Anchored to the right end-cap (height×height), then placed on the NE rim
 * (~45°) so it sits on the curve — not the rectangular bounding-box corner.
 */
export function ListChipsToggleActivePip() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 z-20 aspect-square h-full"
    >
      <span className="absolute left-[85.355%] top-[14.645%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-sm ring-2 ring-background" />
    </span>
  );
}

type ListFilterChipsToggleProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  /** When true, show a discreet pip that a filter selection is active. */
  hasActiveSelection?: boolean;
  className?: string;
};

/**
 * Pressed toggle (checkbox-style) to show/hide list filter chips.
 * Place next to Sort in the mail-layout toolbar.
 */
export function ListFilterChipsToggle({
  visible,
  onVisibleChange,
  hasActiveSelection = false,
  className,
}: ListFilterChipsToggleProps) {
  const { t } = useTranslation();
  const baseLabel = visible ? t('common.hideFilters') : t('common.showFilters');

  return (
    <span className="relative z-10 inline-flex shrink-0 overflow-visible">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          visible ? LIST_FILTER_CHIPS_TOGGLE_CLASS : LIST_FILTER_CHIPS_TOGGLE_OFF_CLASS,
          className,
        )}
        aria-pressed={visible}
        aria-label={hasActiveSelection ? `${baseLabel}. ${t('common.activeSelection')}` : baseLabel}
        data-has-active-selection={hasActiveSelection ? 'true' : undefined}
        onClick={() => onVisibleChange(!visible)}
      >
        <ListFilter className="h-3.5 w-3.5" />
        <span>{t('common.filters')}</span>
      </Button>
      {hasActiveSelection ? <ListChipsToggleActivePip /> : null}
    </span>
  );
}
