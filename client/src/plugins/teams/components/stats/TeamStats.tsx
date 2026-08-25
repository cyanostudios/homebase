import { CalendarRange, Inbox, LayoutGrid, Trophy, Users, UserRound } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  StatKpiTile,
  StatRankedBars,
  StatStackedBar,
  StatTimeSeriesChart,
} from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';

import { useTeamStats } from '../../hooks/useTeamStats';
import { formatPlayersMonthLabel } from '../../utils/buildPlayersByMonth';

export function TeamStats() {
  const { t, i18n } = useTranslation();
  const enabledPlugins = useEnabledPlugins();
  const hasRequests = enabledPlugins.has('requests');
  const stats = useTeamStats(hasRequests);

  const playersByMonthSeries = useMemo(
    () =>
      stats.playersByMonth.map((point) => ({
        key: point.monthKey,
        label: formatPlayersMonthLabel(point.monthKey, i18n.language),
        value: point.value,
      })),
    [stats.playersByMonth, i18n.language],
  );

  const statusSegments = useMemo(
    () => [
      {
        key: 'active',
        label: t('teams.statistics.active'),
        value: stats.byStatus.active,
        color: '#10b981',
      },
      {
        key: 'onBreak',
        label: t('teams.statistics.onBreak'),
        value: stats.byStatus.onBreak,
        color: '#f97316',
      },
      {
        key: 'dormant',
        label: t('teams.statistics.dormant'),
        value: stats.byStatus.dormant,
        color: '#f59e0b',
      },
    ],
    [stats.byStatus, t],
  );

  const genderSegments = useMemo(
    () => [
      {
        key: 'girls',
        label: t('teams.gender.girls'),
        value: stats.byGender.girls,
        color: '#ec4899',
      },
      {
        key: 'boys',
        label: t('teams.gender.boys'),
        value: stats.byGender.boys,
        color: '#3b82f6',
      },
      {
        key: 'mixed',
        label: t('teams.gender.mixed'),
        value: stats.byGender.mixed,
        color: '#a855f7',
      },
      {
        key: 'unknown',
        label: t('teams.statistics.unknownGender'),
        value: stats.byGender.unknown,
        color: '#94a3b8',
      },
    ],
    [stats.byGender, t],
  );

  const seriesSegments = useMemo(
    () => [
      {
        key: 'with',
        label: t('teams.statistics.withSeries'),
        value: stats.withSeriesTeams,
        color: '#10b981',
      },
      {
        key: 'without',
        label: t('teams.statistics.withoutSeries'),
        value: stats.withoutSeriesTeams,
        color: '#94a3b8',
      },
    ],
    [stats.withSeriesTeams, stats.withoutSeriesTeams, t],
  );

  const ageBarItems = useMemo(
    () =>
      stats.ageGroups.map((row) => ({
        key: row.ageGroup,
        label: row.ageGroup,
        value: row.count,
      })),
    [stats.ageGroups],
  );

  const responsibleBarItems = useMemo(
    () => [
      {
        key: 'without',
        label: t('teams.statistics.withoutResponsibles'),
        value: stats.teamsWithoutResponsibles,
      },
      ...stats.roleCounts.map((row) => ({
        key: row.role,
        label: t(`teams.roles.${row.role}`, row.role),
        value: row.count,
      })),
    ],
    [stats.roleCounts, stats.teamsWithoutResponsibles, t],
  );

  const requestSegments = useMemo(() => {
    if (!stats.requests) {
      return [];
    }
    const open = stats.requests.byStatus.notStarted + stats.requests.byStatus.inProgress;
    return [
      {
        key: 'open',
        label: t('teams.statistics.requestsOpen'),
        value: open,
        color: '#3b82f6',
      },
      {
        key: 'completed',
        label: t('teams.statistics.requestsCompleted'),
        value: stats.requests.byStatus.completed,
        color: '#10b981',
      },
      {
        key: 'unlinked',
        label: t('teams.statistics.requestsUnlinked'),
        value: stats.requests.unlinked,
        color: '#f59e0b',
      },
    ];
  }, [stats.requests, t]);

  const topOpenRequestItems = useMemo(() => {
    if (!stats.requests) {
      return [];
    }
    return stats.requests.topTeamsByOpenRequests.map((row) => ({
      key: row.teamId,
      label: row.teamName,
      value: row.openCount,
      secondary: t('teams.statistics.openOfTotal', {
        open: row.openCount,
        total: row.totalCount,
      }),
    }));
  }, [stats.requests, t]);

  return (
    <div className="space-y-6">
      <DetailSection title={t('teams.statistics.overview')} icon={LayoutGrid} subtleTitle>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatKpiTile label={t('teams.statistics.totalTeams')} value={stats.totalTeams} />
          <StatKpiTile label={t('teams.statistics.totalPlayers')} value={stats.totalPlayers} />
          <StatStackedBar
            className="sm:col-span-2"
            title={t('teams.statistics.statusDistribution')}
            segments={statusSegments}
          />
          <StatTimeSeriesChart
            className="sm:col-span-2 lg:col-span-4"
            title={t('teams.statistics.playersOverTime')}
            series={playersByMonthSeries}
            ariaLabel={t('teams.statistics.playersOverTimeAria')}
            valueLabel={t('teams.statistics.playersOverTimeValue')}
            emptyLabel={t('teams.statistics.playersOverTimeEmpty')}
            footer={t('teams.statistics.playersOverTimeHint')}
          />
        </div>
      </DetailSection>

      <DetailSection title={t('teams.statistics.genderDistribution')} icon={Users} subtleTitle>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatStackedBar
            className="sm:col-span-2 lg:col-span-2"
            title={t('teams.statistics.genderDistribution')}
            segments={genderSegments}
          />
        </div>
      </DetailSection>

      {stats.ageGroups.length > 0 && (
        <DetailSection title={t('teams.statistics.ageGroups')} icon={CalendarRange} subtleTitle>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatRankedBars
              className="sm:col-span-2 lg:col-span-2"
              items={ageBarItems}
              emptyLabel="—"
              barColor="#14b8a6"
            />
          </div>
        </DetailSection>
      )}

      <DetailSection title={t('teams.statistics.seriesParticipation')} icon={Trophy} subtleTitle>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatStackedBar
            className="sm:col-span-2"
            title={t('teams.statistics.seriesParticipation')}
            segments={seriesSegments}
          />
          <StatKpiTile
            label={t('teams.statistics.totalSeriesTeams')}
            value={stats.totalSeriesTeams}
          />
        </div>
      </DetailSection>

      <DetailSection title={t('teams.statistics.responsibles')} icon={UserRound} subtleTitle>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatRankedBars
            className="sm:col-span-2 lg:col-span-2"
            items={responsibleBarItems}
            emptyLabel="—"
            barColor="#8b5cf6"
          />
        </div>
      </DetailSection>

      {hasRequests && stats.requests && (
        <DetailSection title={t('teams.statistics.requests')} icon={Inbox} subtleTitle>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatStackedBar
              className="sm:col-span-2 lg:col-span-2"
              title={t('teams.statistics.requestsByStatus')}
              segments={requestSegments}
              footer={t('teams.statistics.requestsTotalCount', {
                count: stats.requests.total,
              })}
            />
            <StatRankedBars
              className="sm:col-span-2 lg:col-span-2"
              title={t('teams.statistics.topOpenRequests')}
              items={topOpenRequestItems}
              emptyLabel={t('teams.statistics.noOpenRequests')}
              barColor="#3b82f6"
            />
          </div>
        </DetailSection>
      )}
    </div>
  );
}
