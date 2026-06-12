import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { cn } from '@/lib/utils';

import { useTeamStats } from '../../hooks/useTeamStats';

function StatCard({
  label,
  value,
  dotClassName,
}: {
  label: string;
  value: number;
  dotClassName: string;
}) {
  return (
    <Card className="rounded-xl border-0 bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClassName)} aria-hidden />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
    </Card>
  );
}

function RankRow({
  rank,
  name,
  openCount,
  totalCount,
}: {
  rank: number;
  name: string;
  openCount: number;
  totalCount: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {rank}
        </span>
        <span className="truncate font-medium">{name}</span>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {t('teams.statistics.openOfTotal', { open: openCount, total: totalCount })}
      </span>
    </div>
  );
}

export function TeamStats() {
  const { t } = useTranslation();
  const enabledPlugins = useEnabledPlugins();
  const hasRequests = enabledPlugins.has('requests');
  const stats = useTeamStats(hasRequests);

  return (
    <div className="space-y-6">
      <DetailSection title={t('teams.statistics.overview')} subtleTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label={t('teams.statistics.totalTeams')}
            value={stats.totalTeams}
            dotClassName="bg-slate-500"
          />
          <StatCard
            label={t('teams.statistics.active')}
            value={stats.byStatus.active}
            dotClassName="bg-emerald-500"
          />
          <StatCard
            label={t('teams.statistics.onBreak')}
            value={stats.byStatus.onBreak}
            dotClassName="bg-amber-500"
          />
          <StatCard
            label={t('teams.statistics.dormant')}
            value={stats.byStatus.dormant}
            dotClassName="bg-slate-400"
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            label={t('teams.statistics.totalPlayers')}
            value={stats.totalPlayers}
            dotClassName="bg-blue-500"
          />
        </div>
      </DetailSection>

      <DetailSection title={t('teams.statistics.genderDistribution')} subtleTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label={t('teams.gender.girls')}
            value={stats.byGender.girls}
            dotClassName="bg-pink-500"
          />
          <StatCard
            label={t('teams.gender.boys')}
            value={stats.byGender.boys}
            dotClassName="bg-blue-500"
          />
          <StatCard
            label={t('teams.gender.mixed')}
            value={stats.byGender.mixed}
            dotClassName="bg-purple-500"
          />
          <StatCard
            label={t('teams.statistics.unknownGender')}
            value={stats.byGender.unknown}
            dotClassName="bg-slate-400"
          />
        </div>
      </DetailSection>

      {stats.ageGroups.length > 0 && (
        <DetailSection title={t('teams.statistics.ageGroups')} subtleTitle>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {stats.ageGroups.map((row) => (
              <StatCard
                key={row.ageGroup}
                label={row.ageGroup}
                value={row.count}
                dotClassName="bg-teal-500"
              />
            ))}
          </div>
        </DetailSection>
      )}

      <DetailSection title={t('teams.statistics.seriesParticipation')} subtleTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard
            label={t('teams.statistics.withSeries')}
            value={stats.withSeriesTeams}
            dotClassName="bg-emerald-500"
          />
          <StatCard
            label={t('teams.statistics.withoutSeries')}
            value={stats.withoutSeriesTeams}
            dotClassName="bg-slate-400"
          />
          <StatCard
            label={t('teams.statistics.totalSeriesTeams')}
            value={stats.totalSeriesTeams}
            dotClassName="bg-indigo-500"
          />
        </div>
      </DetailSection>

      <DetailSection title={t('teams.statistics.responsibles')} subtleTitle>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            label={t('teams.statistics.withoutResponsibles')}
            value={stats.teamsWithoutResponsibles}
            dotClassName="bg-rose-500"
          />
        </div>
        {stats.roleCounts.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stats.roleCounts.map((row) => (
              <StatCard
                key={row.role}
                label={t(`teams.roles.${row.role}`, row.role)}
                value={row.count}
                dotClassName="bg-violet-500"
              />
            ))}
          </div>
        )}
      </DetailSection>

      {hasRequests && stats.requests && (
        <DetailSection title={t('teams.statistics.requests')} subtleTitle>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label={t('teams.statistics.requestsTotal')}
              value={stats.requests.total}
              dotClassName="bg-slate-500"
            />
            <StatCard
              label={t('teams.statistics.requestsOpen')}
              value={stats.requests.byStatus.notStarted + stats.requests.byStatus.inProgress}
              dotClassName="bg-blue-500"
            />
            <StatCard
              label={t('teams.statistics.requestsCompleted')}
              value={stats.requests.byStatus.completed}
              dotClassName="bg-emerald-500"
            />
            <StatCard
              label={t('teams.statistics.requestsUnlinked')}
              value={stats.requests.unlinked}
              dotClassName="bg-amber-500"
            />
          </div>

          {stats.requests.topTeamsByOpenRequests.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('teams.statistics.topOpenRequests')}
              </p>
              {stats.requests.topTeamsByOpenRequests.map((row, index) => (
                <RankRow
                  key={row.teamId}
                  rank={index + 1}
                  name={row.teamName}
                  openCount={row.openCount}
                  totalCount={row.totalCount}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {t('teams.statistics.noOpenRequests')}
            </p>
          )}
        </DetailSection>
      )}
    </div>
  );
}
