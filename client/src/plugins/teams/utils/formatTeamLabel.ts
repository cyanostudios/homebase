/** Label for team selects / schedule: "Flickor 2017 · F9". */
export function formatTeamLabel(team: { name?: string | null; age_group?: string | null }): string {
  return [team.name?.trim(), team.age_group?.trim()].filter(Boolean).join(' · ');
}
