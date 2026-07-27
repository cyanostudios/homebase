import type { Team } from '../../types/teams';
import { filterTeamsForContact, listTeamAssignmentsForContact } from '../teamContactUtils';

function makeTeam(overrides: Partial<Team> & Pick<Team, 'id' | 'name'>): Team {
  return {
    age_group: 'F9',
    gender: 'girls',
    playing_format: null,
    player_count: 0,
    series_team_count: 0,
    series_teams: [],
    status: 'active',
    status_note: null,
    team_notes: [],
    training_times: [],
    season_breaks: [],
    responsibles: [],
    color: 'blue',
    external_team_id: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('filterTeamsForContact', () => {
  it('returns teams where contact is a responsible', () => {
    const teams: Team[] = [
      makeTeam({
        id: 't1',
        name: 'With contact',
        responsibles: [{ contactId: '42', role: 'coach' }],
      }),
      makeTeam({
        id: 't2',
        name: 'Other',
        responsibles: [{ contactId: '99', role: 'coach' }],
      }),
      makeTeam({ id: 't3', name: 'Empty', responsibles: [] }),
    ];

    expect(filterTeamsForContact(teams, '42').map((t) => t.id)).toEqual(['t1']);
    expect(filterTeamsForContact(teams, 42 as unknown as string).map((t) => t.id)).toEqual(['t1']);
  });

  it('returns empty when no match', () => {
    expect(filterTeamsForContact([], '1')).toEqual([]);
    expect(
      filterTeamsForContact(
        [makeTeam({ id: 't1', name: 'A', responsibles: [{ contactId: '2', role: 'other' }] })],
        '1',
      ),
    ).toEqual([]);
  });
});

describe('listTeamAssignmentsForContact', () => {
  it('returns one row per responsible link including role', () => {
    const team = makeTeam({
      id: 't1',
      name: 'Alpha',
      series_teams: [{ name: 'Vit', level: 'F9', color: 'white' }],
      responsibles: [
        { contactId: '42', role: 'coach', seriesTeam: 'Vit' },
        { contactId: '42', role: 'team_leader' },
        { contactId: '7', role: 'coach' },
      ],
    });

    const rows = listTeamAssignmentsForContact([team], '42');
    expect(rows).toHaveLength(2);
    expect(rows[0].responsible.role).toBe('coach');
    expect(rows[0].responsible.seriesTeam).toBe('Vit');
    expect(rows[1].responsible.role).toBe('team_leader');
  });
});
