import { ChevronRight } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { LIST_FILTER_CHIP_CLASS } from '@/core/ui/detailViewCardStyles';
import { usePulses } from '@/plugins/pulses/hooks/usePulses';

export function PulsesDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { t } = useTranslation();
  const { pulseHistory } = usePulses();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t('pulses.sentCount', { count: pulseHistory.length })}
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
        {t('pulses.openPulse')}
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
