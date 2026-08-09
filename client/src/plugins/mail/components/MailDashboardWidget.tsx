import { ChevronRight } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { LIST_FILTER_CHIP_CLASS } from '@/core/ui/detailViewCardStyles';
import { useMail } from '@/plugins/mail/hooks/useMail';

export function MailDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { t } = useTranslation();
  const { mailHistory } = useMail();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t('mail.sentCount', { count: mailHistory.length })}
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
        {t('mail.openMail')}
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
