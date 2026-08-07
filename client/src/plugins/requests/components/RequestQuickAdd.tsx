import React from 'react';
import { useTranslation } from 'react-i18next';

import { ListQuickAdd } from '@/core/ui/ListQuickAdd';

type ViewMode = 'grid' | 'list';
type Layout = 'block' | 'footer' | 'toolbar';

export function RequestQuickAdd({
  viewMode,
  onCreate,
  className,
  layout = 'block',
  open,
  onOpenChange,
}: {
  viewMode: ViewMode;
  onCreate: (title: string) => Promise<void>;
  className?: string;
  layout?: Layout;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <ListQuickAdd
      viewMode={viewMode}
      onCreate={onCreate}
      className={className}
      layout={layout}
      open={open}
      onOpenChange={onOpenChange}
      label={t('requests.quickAdd')}
      titleLabel={t('requests.form.title')}
      titlePlaceholder={t('requests.form.titlePlaceholder')}
      saveLabel={t('common.save')}
      cancelLabel={t('common.cancel')}
      errorContext="request"
    />
  );
}
