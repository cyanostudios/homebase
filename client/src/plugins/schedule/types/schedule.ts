import type { Team, TeamColor } from '@/plugins/teams/types/teams';

export interface ScheduleSlot {
  day: string;
  startTime: string;
  endTime: string;
  location: string;
  teamId?: string;
  teamName?: string;
  teamColor?: TeamColor;
  title?: string;
}

export function buildTeamSlots(teams: Team[], teamFilter: string): ScheduleSlot[] {
  const filteredTeams =
    teamFilter === 'all' ? teams : teams.filter((team) => String(team.id) === teamFilter);

  return filteredTeams.flatMap((team) =>
    (team.training_times || [])
      .filter((training) => training.day)
      .map((training) => ({
        day: training.day,
        startTime: training.startTime,
        endTime: training.endTime,
        location: training.location,
        teamId: team.id,
        teamName: team.name,
        teamColor: team.color,
      })),
  );
}
