import React from 'react';
import { useTranslation } from 'react-i18next';

import type { MatchSideSplit } from '../../types/matchStats';

import { MatchRecordMetricsGrid } from './MatchRecordMetricsGrid';

export function MatchSideSplitSection({
  sides,
  showSideBreakdown = true,
}: {
  sides: MatchSideSplit;
  showSideBreakdown?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('matches.statistics.total')}
        </p>
        <MatchRecordMetricsGrid metrics={sides.total} />
      </div>
      {showSideBreakdown ? (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('matches.statistics.home')}
            </p>
            <MatchRecordMetricsGrid metrics={sides.home} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('matches.statistics.away')}
            </p>
            <MatchRecordMetricsGrid metrics={sides.away} />
          </div>
        </>
      ) : null}
    </div>
  );
}
