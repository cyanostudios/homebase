import type { Responsible, Team } from '../types/teams';

/** Teams where the contact appears in responsibles (coach, leader, etc.). */
export function filterTeamsForContact(teams: Team[], contactId: string): Team[] {
  const id = String(contactId);
  return teams.filter(
    (team) =>
      Array.isArray(team.responsibles) && team.responsibles.some((r) => String(r.contactId) === id),
  );
}

export type TeamAssignmentForContact = {
  team: Team;
  responsible: Responsible;
};

/** One row per responsible link (same contact can appear twice with different roles/series). */
export function listTeamAssignmentsForContact(
  teams: Team[],
  contactId: string,
): TeamAssignmentForContact[] {
  const id = String(contactId);
  const rows: TeamAssignmentForContact[] = [];
  for (const team of teams) {
    if (!Array.isArray(team.responsibles)) {
      continue;
    }
    for (const responsible of team.responsibles) {
      if (String(responsible.contactId) === id) {
        rows.push({ team, responsible });
      }
    }
  }
  return rows;
}
