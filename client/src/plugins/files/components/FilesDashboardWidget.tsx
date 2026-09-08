import { ChevronRight } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { LIST_FILTER_CHIP_CLASS } from '@/core/ui/detailViewCardStyles';
import { useFiles } from '@/plugins/files/hooks/useFiles';

export function FilesDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { t } = useTranslation();
  const { files } = useFiles();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t('files.widgetCount', { count: files.length })}
      </p>
      <Button
        variant="ghost"
        size="sm"
        className={LIST_FILTER_CHIP_CLASS}
        onClick={(e) => {
          e.stopPropagation();
          onOpenPlugin();
        }}
      >
        {t('files.widgetOpen')}
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
