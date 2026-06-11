import React from 'react';
import { useTranslation } from 'react-i18next';

import { ListQuickAdd } from '@/core/ui/ListQuickAdd';

type ViewMode = 'grid' | 'list';

export function TaskQuickAdd({
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
      label={t('tasks.quickAdd')}
      titleLabel={t('tasks.title')}
      titlePlaceholder={t('tasks.titlePlaceholder')}
      saveLabel={t('common.save')}
      cancelLabel={t('common.cancel')}
      errorContext="task"
    />
  );
}
