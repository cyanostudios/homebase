import React from 'react';
import { useTranslation } from 'react-i18next';

import { TeamStats } from './stats/TeamStats';

interface TeamsStatisticsViewProps {
  inlineTrailing?: React.ReactNode;
}

export function TeamsStatisticsView({ inlineTrailing }: TeamsStatisticsViewProps = {}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex flex-shrink-0 items-center justify-between">
        <div className="mr-4 flex min-w-0 flex-1 items-center gap-4">
          <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
            {t('teams.statistics.title')}
          </h2>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">{inlineTrailing}</div>
      </div>

      <TeamStats />
    </div>
  );
}
