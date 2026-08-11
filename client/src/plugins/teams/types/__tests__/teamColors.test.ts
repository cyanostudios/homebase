import {
  isLightTeamColor,
  SERIES_TEAM_BADGE_STYLES,
  SERIES_TEAM_ROW_STYLES,
  TEAM_COLOR_GRADIENTS,
  TEAM_COLOR_STRIPES,
  TEAM_COLORS,
  teamColorGradientTextClass,
  type TeamColor,
} from '../teams';

const CANONICAL_COLORS: TeamColor[] = [
  'black',
  'white',
  'red',
  'blue',
  'green',
  'yellow',
  'orange',
  'purple',
  'teal',
];

describe('team color palette', () => {
  it('matches the canonical backend palette order', () => {
    expect(TEAM_COLORS).toEqual(CANONICAL_COLORS);
  });

  it('defines style maps for every team color', () => {
    for (const color of TEAM_COLORS) {
      expect(TEAM_COLOR_GRADIENTS[color]).toBeTruthy();
      expect(TEAM_COLOR_STRIPES[color]).toBeTruthy();
      expect(SERIES_TEAM_ROW_STYLES[color]).toBeTruthy();
      expect(SERIES_TEAM_BADGE_STYLES[color]).toBeTruthy();
    }
  });

  it('treats white and yellow as light colors for contrast', () => {
    expect(isLightTeamColor('white')).toBe(true);
    expect(isLightTeamColor('yellow')).toBe(true);
    expect(isLightTeamColor('black')).toBe(false);
    expect(isLightTeamColor('green')).toBe(false);
  });

  it('uses dark text on yellow gradients', () => {
    expect(teamColorGradientTextClass('yellow')).toContain('text-slate-900');
    expect(teamColorGradientTextClass('black')).toBe('text-white');
  });
});
