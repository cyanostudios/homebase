import React from 'react';
import { useTranslation } from 'react-i18next';

import { ListQuickAdd } from '@/core/ui/ListQuickAdd';

type ViewMode = 'grid' | 'list';

export function NoteQuickAdd({
  viewMode,
  onCreate,
  className,
}: {
  viewMode: ViewMode;
  onCreate: (title: string) => Promise<void>;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <ListQuickAdd
      viewMode={viewMode}
      onCreate={onCreate}
      className={className}
      label={t('notes.quickAdd')}
      titleLabel={t('notes.title')}
      titlePlaceholder={t('notes.titlePlaceholder')}
      saveLabel={t('common.save')}
      cancelLabel={t('common.cancel')}
      errorContext="note"
    />
  );
}
