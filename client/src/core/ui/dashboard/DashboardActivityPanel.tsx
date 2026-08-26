import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  SERIES_TEAM_BADGE_NEUTRAL_STYLE,
  SERIES_TEAM_BADGE_STYLES,
} from '@/plugins/teams/types/teams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import type { DashboardDataProps } from './dashboardTypes';
import { formatDate } from './dashboardUtils';

export function DashboardActivityPanel({ has, matches, teams }: DashboardDataProps) {
  const { t } = useTranslation();

  const teamsById = useMemo(() => new Map(teams.map((team) => [String(team.id), team])), [teams]);

  const upcomingMatches = useMemo(() => {
    const now = new Date();
    return matches
      .filter((m) => m.start_time && new Date(m.start_time) > now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 5);
  }, [matches]);

  if (!has('matches')) {
    return null;
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {t('dashboard.upcomingActivity')}
      </p>
      <div className="space-y-1">
        {upcomingMatches.map((match) => {
          const team = match.team_id ? teamsById.get(String(match.team_id)) : undefined;
          const teamLabel = team ? formatTeamLabel(team) : null;
          const badgeStyle = team
            ? (SERIES_TEAM_BADGE_STYLES[team.color] ?? SERIES_TEAM_BADGE_NEUTRAL_STYLE)
            : SERIES_TEAM_BADGE_NEUTRAL_STYLE;
          return (
            <div
              key={match.id}
              className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-2 text-xs hover:bg-muted/40"
            >
              <div className="flex min-w-0 items-center gap-2">
                {teamLabel && (
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${badgeStyle}`}
                  >
                    {teamLabel}
                  </span>
                )}
                <span className="min-w-0 truncate font-medium text-foreground">
                  {match.home_team} – {match.away_team}
                </span>
              </div>
              <span className="shrink-0 text-muted-foreground">{formatDate(match.start_time)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
