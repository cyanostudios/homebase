import { LayoutGrid } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StatKpiTile } from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';

import { useTeams } from '../hooks/useTeams';
import { isTeamOnBreak } from '../types/teams';

import { TeamStats } from './stats/TeamStats';

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

interface TeamsStatisticsViewProps {
  onClose?: () => void;
}

export function TeamsStatisticsView({ onClose }: TeamsStatisticsViewProps = {}) {
  const { t } = useTranslation();
  const { teams } = useTeams();
  const isEmbedded = onClose == null;

  useMobileBarOverride(onClose ? { onClose } : null);

  const stats = useMemo(() => {
    let active = 0;
    let breakCount = 0;
    let dormant = 0;
    let totalPlayers = 0;
    for (const team of teams) {
      totalPlayers += team.player_count ?? 0;
      if (isTeamOnBreak(team)) {
        breakCount += 1;
      } else if (team.status === 'dormant') {
        dormant += 1;
      } else if (team.status === 'active') {
        active += 1;
      }
    }
    return { total: teams.length, active, break: breakCount, dormant, totalPlayers };
  }, [teams]);

  const overviewSection = (
    <DetailSection title={t('teams.statistics.overview')} icon={LayoutGrid} subtleTitle>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
        <StatKpiTile
          label={t('teams.statistics.totalTeams')}
          value={stats.total}
          className={STAT_KPI_SOFT_CLASS}
          labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
          valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
        />
        <StatKpiTile
          label={t('teams.statistics.active')}
          value={stats.active}
          className={STAT_KPI_SOFT_CLASS}
          labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
          valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
        />
        <StatKpiTile
          label={t('teams.statistics.onBreak')}
          value={stats.break}
          className={STAT_KPI_SOFT_CLASS}
          labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
          valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
        />
        <StatKpiTile
          label={t('teams.statistics.dormant')}
          value={stats.dormant}
          className={STAT_KPI_SOFT_CLASS}
          labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
          valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
        />
      </div>
    </DetailSection>
  );

  if (isEmbedded) {
    return (
      <div className="space-y-6">
        <div className={PLUGIN_PAGE_HEADER_CLASS}>
          <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
            <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('teams.statistics.title')}</h2>
          </div>
        </div>
        <p className="hidden text-sm text-muted-foreground md:block">
          {t('teams.statistics.embeddedDescription', {
            defaultValue: 'Overview of team status and roster size.',
          })}
        </p>
        {overviewSection}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden flex-shrink-0 items-center justify-between md:flex">
        <div className="mr-4 flex min-w-0 flex-1 items-center gap-4">
          <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
            {t('teams.statistics.title')}
          </h2>
        </div>
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
      </div>

      <TeamStats />
    </div>
  );
}
