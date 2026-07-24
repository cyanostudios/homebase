import {
  classifyExternalOptionsError,
  filterExternalTeamsByName,
  findOccupiedByOther,
  formatExternalTeamLabel,
  isOrphanExternalTeamId,
} from '../externalTeamOptions';
import type { ExternalTeamOption, OccupiedExternalTeam } from '../../types/teams';

describe('externalTeamOptions helpers', () => {
  const occupied: OccupiedExternalTeam[] = [
    { externalTeamId: '10', teamId: '1', teamName: 'P17' },
    { externalTeamId: '20', teamId: '2', teamName: 'F15' },
  ];

  test('classifyExternalOptionsError detects missing API key', () => {
    expect(
      classifyExternalOptionsError({
        message: 'API key not configured. Add it in Matches settings.',
        status: 400,
        code: 'VALIDATION_ERROR',
      }),
    ).toBe('missing_api_key');
    expect(classifyExternalOptionsError({ message: 'Upstream failed', status: 502 })).toBe('error');
  });

  test('findOccupiedByOther ignores current team occupancy', () => {
    expect(findOccupiedByOther(occupied, '10', '1')).toBeNull();
    expect(findOccupiedByOther(occupied, '10', '9')?.teamName).toBe('P17');
    expect(findOccupiedByOther(occupied, '99', '1')).toBeNull();
  });

  test('isOrphanExternalTeamId', () => {
    expect(isOrphanExternalTeamId('10', ['10', '20'])).toBe(false);
    expect(isOrphanExternalTeamId('99', ['10', '20'])).toBe(true);
    expect(isOrphanExternalTeamId('', ['10'])).toBe(false);
  });

  test('formatExternalTeamLabel uses name (id) age', () => {
    expect(
      formatExternalTeamLabel({
        name: 'Sorgenfri FF',
        externalTeamId: '324323',
        ageHints: ['F16'],
      }),
    ).toBe('Sorgenfri FF (324323) F16');
    expect(
      formatExternalTeamLabel({
        name: 'Sorgenfri FF',
        externalTeamId: '324323',
        ageHints: [],
      }),
    ).toBe('Sorgenfri FF (324323)');
  });

  test('filterExternalTeamsByName filters on team name only', () => {
    const teams: ExternalTeamOption[] = [
      { externalTeamId: '1', name: 'Sorgenfri FF', matchCount: 2, ageHints: ['F16'] },
      { externalTeamId: '2', name: 'Malmö FF', matchCount: 1, ageHints: ['P17'] },
    ];
    expect(filterExternalTeamsByName(teams, 'sorgen')).toHaveLength(1);
    expect(filterExternalTeamsByName(teams, 'F16')).toHaveLength(0);
    expect(filterExternalTeamsByName(teams, '')).toHaveLength(2);
  });
});
