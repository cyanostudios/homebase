import React from 'react';
import { useTranslation } from 'react-i18next';

import { ListQuickAdd } from '@/core/ui/ListQuickAdd';

type ViewMode = 'grid' | 'list';

export function RequestQuickAdd({
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
      label={t('requests.quickAdd')}
      titleLabel={t('requests.form.title')}
      titlePlaceholder={t('requests.form.titlePlaceholder')}
      saveLabel={t('common.save')}
      cancelLabel={t('common.cancel')}
      errorContext="request"
    />
  );
}
