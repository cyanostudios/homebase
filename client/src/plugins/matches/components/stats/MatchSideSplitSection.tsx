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

  const blocks = [
    { key: 'total', title: t('matches.statistics.total'), metrics: sides.total },
    ...(showSideBreakdown
      ? [
          { key: 'home', title: t('matches.statistics.home'), metrics: sides.home },
          { key: 'away', title: t('matches.statistics.away'), metrics: sides.away },
        ]
      : []),
  ];

  // Three metric cards (Total / Home / Away) at ~⅓ row until more stats exist.
  return (
    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {blocks.map((block) => (
        <MatchRecordMetricsGrid key={block.key} title={block.title} metrics={block.metrics} />
      ))}
    </div>
  );
}
