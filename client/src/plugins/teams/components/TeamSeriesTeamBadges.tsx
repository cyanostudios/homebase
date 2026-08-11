import React, { useMemo } from 'react';

import {
  formatSeriesTeamLabel,
  getDisplaySeriesTeams,
  getSeriesTeamColorForName,
  getSeriesTeamKey,
  type Team,
} from '../types/teams';
import { SeriesTeamBadge } from './ResponsibleRow';

export function TeamSeriesTeamBadges({
  team,
  empty = null,
}: {
  team: Team;
  empty?: React.ReactNode;
}) {
  const seriesTeams = useMemo(
    () => getDisplaySeriesTeams(team.series_teams ?? [], team.series_team_count),
    [team.series_team_count, team.series_teams],
  );

  if (seriesTeams.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {seriesTeams.map((seriesTeam, index) => {
        const key = getSeriesTeamKey(seriesTeam);
        return (
          <SeriesTeamBadge
            key={`${key}-${index}`}
            label={formatSeriesTeamLabel(seriesTeam)}
            color={getSeriesTeamColorForName(team, key)}
          />
        );
      })}
    </div>
  );
}
