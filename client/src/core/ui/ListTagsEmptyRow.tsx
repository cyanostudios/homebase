import { Settings } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import {
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

type ListTagsEmptyRowProps = {
  onOpenSettings: () => void;
  className?: string;
};

/**
 * Empty tag-chip row: points users to Settings to create the first catalog tag.
 */
export function ListTagsEmptyRow({ onOpenSettings, className }: ListTagsEmptyRowProps) {
  const { t } = useTranslation();

  return (
    <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS, className)}>
      <p className="shrink-0 text-sm text-muted-foreground">{t('common.tagsEmptyHint')}</p>
      <RoundIconLabelButton
        type="button"
        icon={Settings}
        label={t('common.addTagsInSettings')}
        variant="soft"
        size="xs"
        alwaysExpanded
        onClick={onOpenSettings}
      />
    </div>
  );
}
