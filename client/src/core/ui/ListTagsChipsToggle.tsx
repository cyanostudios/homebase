import { Tag } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  ListChipsToggleActivePip,
  LIST_FILTER_CHIPS_TOGGLE_CLASS,
  LIST_FILTER_CHIPS_TOGGLE_OFF_CLASS,
} from '@/core/ui/ListFilterChipsToggle';
import { cn } from '@/lib/utils';

type ListTagsChipsToggleProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  /** When true, show a discreet pip that a tag selection is active. */
  hasActiveSelection?: boolean;
  className?: string;
};

/**
 * Pressed toggle (checkbox-style) to show/hide list tag chips.
 * Place next to Filters in the mail-layout toolbar when the plugin has a tag catalog.
 */
export function ListTagsChipsToggle({
  visible,
  onVisibleChange,
  hasActiveSelection = false,
  className,
}: ListTagsChipsToggleProps) {
  const { t } = useTranslation();
  const baseLabel = visible ? t('common.hideTags') : t('common.showTags');

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
        <Tag className="h-3.5 w-3.5" />
        <span>{t('common.tags')}</span>
      </Button>
      {hasActiveSelection ? <ListChipsToggleActivePip /> : null}
    </span>
  );
}
