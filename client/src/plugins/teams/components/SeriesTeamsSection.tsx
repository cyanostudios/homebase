import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Team } from '../types/teams';
import { getDisplaySeriesTeams, getSeriesTeamColorForName, getSeriesTeamKey } from '../types/teams';

import { SeriesTeamBadge } from './ResponsibleRow';

export function SeriesTeamsSection({ team }: { team: Team }) {
  const { t } = useTranslation();
  const seriesTeams = useMemo(
    () => getDisplaySeriesTeams(team.series_teams ?? [], team.series_team_count),
    [team.series_team_count, team.series_teams],
  );

  if (seriesTeams.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('teams.view.noSeriesTeams')}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {seriesTeams.map((seriesTeam, index) => {
        const key = getSeriesTeamKey(seriesTeam);
        const name = seriesTeam.name.trim();
        const level = seriesTeam.level?.trim();
        const badgeLabel = name || level || t('teams.form.seriesTeamLabel');
        return (
          <li
            key={`${key || 'series'}-${index}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5"
          >
            <SeriesTeamBadge label={badgeLabel} color={getSeriesTeamColorForName(team, key)} />
            {name && level ? (
              <span className="min-w-0 truncate text-xs text-muted-foreground">{level}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
