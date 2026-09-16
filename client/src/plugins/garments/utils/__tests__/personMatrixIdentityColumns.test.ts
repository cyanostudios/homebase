import type { PersonMatrixIdentityColumnId } from '../personMatrixIdentityColumns';
import {
  DEFAULT_PERSON_MATRIX_IDENTITY_COLUMNS,
  getPersonMatrixIdentityPrefForList,
  normalizePersonMatrixIdentityByList,
  normalizePersonMatrixIdentityColumns,
  personMatrixIdentityColumnsEqual,
  reorderPersonMatrixIdentityColumns,
  resolveVisiblePersonMatrixIdentityColumns,
  setPersonMatrixIdentityColumnHidden,
} from '../personMatrixIdentityColumns';

describe('personMatrixIdentityColumns', () => {
  it('defaults to name-only visible with other identity columns hidden', () => {
    const pref = normalizePersonMatrixIdentityColumns(null);
    expect(pref).toEqual(DEFAULT_PERSON_MATRIX_IDENTITY_COLUMNS);
    expect(pref.hidden).toEqual(['team', 'jerseyName', 'initials', 'jerseyNumber']);
    expect(pref.order[0]).toBe('name');
  });

  it('allows hiding team, jerseyName, initials, jerseyNumber but not name', () => {
    const pref = normalizePersonMatrixIdentityColumns({
      order: ['name', 'team', 'jerseyName', 'initials', 'jerseyNumber'],
      hidden: ['name', 'team', 'jerseyNumber'],
    });
    expect(pref.hidden).toEqual(['team', 'jerseyNumber']);
  });

  it('resolveVisible always returns name-only (settings prefs removed)', () => {
    const settings = {
      personMatrixIdentityByList: {
        '1': {
          order: ['name', 'team', 'jerseyName', 'initials', 'jerseyNumber'],
          hidden: ['initials', 'jerseyName'],
        },
      },
    };
    expect(resolveVisiblePersonMatrixIdentityColumns(settings, '1')).toEqual(['name']);
    expect(resolveVisiblePersonMatrixIdentityColumns(settings, 'missing')).toEqual(['name']);
  });

  it('getPersonMatrixIdentityPrefForList always returns code defaults', () => {
    const settings = {
      personMatrixIdentityByList: {
        '2': {
          order: ['jerseyNumber', 'name', 'initials', 'team', 'jerseyName'],
          hidden: ['team'],
        },
      },
    };
    expect(getPersonMatrixIdentityPrefForList(settings, '2')).toEqual(
      DEFAULT_PERSON_MATRIX_IDENTITY_COLUMNS,
    );
  });

  it('updates per-list map and compares prefs', () => {
    const base = getPersonMatrixIdentityPrefForList(null, '9');
    const next = setPersonMatrixIdentityColumnHidden(base, 'team', true);
    // team already hidden in defaults — equal when already hidden
    expect(personMatrixIdentityColumnsEqual(base, next)).toBe(true);
    const shown = setPersonMatrixIdentityColumnHidden(base, 'team', false);
    expect(personMatrixIdentityColumnsEqual(base, shown)).toBe(false);
    const reordered = {
      ...shown,
      order: reorderPersonMatrixIdentityColumns(shown.order, 'jerseyNumber', 'team'),
    };
    expect(reordered.order.indexOf('jerseyNumber')).toBeLessThan(reordered.order.indexOf('team'));
    const byList = normalizePersonMatrixIdentityByList({
      '9': reordered,
    });
    expect(byList['9'].hidden).not.toContain('team');
  });

  it('keeps known ids only in by-list map', () => {
    const byList = normalizePersonMatrixIdentityByList({
      '1': { order: ['name', 'bogus'], hidden: ['jerseyName'] },
      '': { order: ['name'], hidden: [] },
    });
    expect(Object.keys(byList)).toEqual(['1']);
    expect(byList['1'].order).toContain('name');
    expect(byList['1'].order).not.toContain('bogus' as PersonMatrixIdentityColumnId);
    expect(byList['1'].hidden).toEqual(['jerseyName']);
  });
});
