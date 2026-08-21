/** Label for team selects / lists / schedule: age group (e.g. F10), falling back to name. */
export function formatTeamLabel(team: { name?: string | null; age_group?: string | null }): string {
  const age = team.age_group?.trim();
  if (age) {
    return age;
  }
  return team.name?.trim() || '';
}
