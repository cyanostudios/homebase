import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import { cn } from '@/lib/utils';

import { MatchSeriesStats } from './stats/MatchSeriesStats';
import { MatchStats } from './stats/MatchStats';

interface MatchesStatisticsViewProps {
  onClose?: () => void;
}

type StatsTab = 'results' | 'series';

export function MatchesStatisticsView({ onClose }: MatchesStatisticsViewProps = {}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<StatsTab>('results');

  useMobileBarOverride(onClose ? { onClose } : null);

  return (
    <div className="space-y-4">
      <div className="hidden flex-shrink-0 items-center justify-between md:flex">
        <div className="mr-4 flex min-w-0 flex-1 items-center gap-4">
          <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
            {t('matches.statistics.title')}
          </h2>
        </div>
        {onClose ? (
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={X}
              className="h-9 px-3 text-xs"
              onClick={onClose}
            >
              {t('common.close')}
            </Button>
          </div>
        ) : null}
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {tab === 'series' ? t('matches.series.description') : t('matches.statistics.description')}
      </p>

      <div className={LIST_FILTER_CHIP_ROW_CLASS}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setTab('results')}
          className={cn(tab === 'results' ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
        >
          {t('matches.series.tabResults')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setTab('series')}
          className={cn(tab === 'series' ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
        >
          {t('matches.series.tabSeries')}
        </Button>
      </div>

      {tab === 'series' ? <MatchSeriesStats /> : <MatchStats />}
    </div>
  );
}
