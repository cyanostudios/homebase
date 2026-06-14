import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildSlug } from '@/core/utils/slugUtils';
import { SeriesTeamBadge } from '@/plugins/teams/components/ResponsibleRow';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import { TEAM_COLORS, type TeamColor } from '@/plugins/teams/types/teams';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

export function MatchTeamBadge({
  teamId,
  size = 'default',
  linkable = true,
}: {
  teamId: string | null | undefined;
  size?: 'default' | 'header';
  linkable?: boolean;
}) {
  const { teams } = useTeams();
  const navigate = useNavigate();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const team = useMemo(
    () => (teamId ? teams.find((entry) => String(entry.id) === String(teamId)) : null),
    [teamId, teams],
  );

  if (!team) {
    return null;
  }

  const color: TeamColor | null =
    team.color && TEAM_COLORS.includes(team.color as TeamColor) ? (team.color as TeamColor) : null;

  const badge = <SeriesTeamBadge label={team.name} color={color} size={size} />;

  if (!linkable) {
    return badge;
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        attemptNavigation(() => {
          navigate(`/teams/${buildSlug(team, teams, 'name')}`);
        });
      }}
      className={cn(
        'inline-flex rounded-full transition-opacity hover:opacity-80',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      {badge}
    </button>
  );
}
