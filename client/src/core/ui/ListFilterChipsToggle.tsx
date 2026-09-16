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

type ListFilterChipsToggleProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  className?: string;
};

/**
 * Pressed toggle (checkbox-style) to show/hide list filter chips.
 * Place next to Sort in the mail-layout toolbar.
 */
export function ListFilterChipsToggle({
  visible,
  onVisibleChange,
  className,
}: ListFilterChipsToggleProps) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        visible ? LIST_FILTER_CHIPS_TOGGLE_CLASS : LIST_FILTER_CHIPS_TOGGLE_OFF_CLASS,
        className,
      )}
      aria-pressed={visible}
      aria-label={visible ? t('common.hideFilters') : t('common.showFilters')}
      onClick={() => onVisibleChange(!visible)}
    >
      <ListFilter className="h-3.5 w-3.5" />
      <span>{t('common.filters')}</span>
    </Button>
  );
}
