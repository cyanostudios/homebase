import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { DashboardDataProps } from './dashboardTypes';
import { formatDate } from './dashboardUtils';

export function DashboardActivityPanel({ has, matches, teams }: DashboardDataProps) {
  const { t } = useTranslation();
  const showMatches = has('matches');
  const showTeamsTraining = has('schedule') && has('teams');

  const upcomingMatches = useMemo(() => {
    const now = new Date();
    return matches
      .filter((m) => m.start_time && new Date(m.start_time) > now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 5);
  }, [matches]);

  const teamsWithTraining = useMemo(
    () => teams.filter((team) => team.training_times.length > 0).slice(0, 5),
    [teams],
  );

  if (!showMatches && !showTeamsTraining) {
    return null;
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {t('dashboard.upcomingActivity')}
      </p>
      <div className="space-y-1">
        {showMatches &&
          upcomingMatches.map((match) => (
            <div
              key={match.id}
              className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-2 text-xs hover:bg-muted/40"
            >
              <span className="min-w-0 truncate font-medium text-foreground">
                {match.home_team} – {match.away_team}
              </span>
              <span className="shrink-0 text-muted-foreground">{formatDate(match.start_time)}</span>
            </div>
          ))}
        {showTeamsTraining &&
          teamsWithTraining.map((team) => (
            <div
              key={team.id}
              className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-2 text-xs hover:bg-muted/40"
            >
              <span className="min-w-0 truncate font-medium text-foreground">{team.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {t('dashboard.sessionsPerWeek', { count: team.training_times.length })}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
