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
  it('defaults to all identity columns visible', () => {
    const pref = normalizePersonMatrixIdentityColumns(null);
    expect(pref).toEqual(DEFAULT_PERSON_MATRIX_IDENTITY_COLUMNS);
    expect(pref.hidden).toEqual([]);
    expect(pref.order[0]).toBe('name');
  });

  it('allows hiding team, jerseyName, initials, jerseyNumber but not name', () => {
    const pref = normalizePersonMatrixIdentityColumns({
      order: ['name', 'team', 'jerseyName', 'initials', 'jerseyNumber'],
      hidden: ['name', 'team', 'jerseyNumber'],
    });
    expect(pref.hidden).toEqual(['team', 'jerseyNumber']);
  });

  it('resolveVisible respects per-list settings prefs', () => {
    const settings = {
      personMatrixIdentityByList: {
        '1': {
          order: ['name', 'team', 'jerseyName', 'initials', 'jerseyNumber'],
          hidden: ['initials', 'jerseyName'],
        },
      },
    };
    expect(resolveVisiblePersonMatrixIdentityColumns(settings, '1')).toEqual([
      'name',
      'team',
      'jerseyNumber',
    ]);
    expect(resolveVisiblePersonMatrixIdentityColumns(settings, 'missing')).toEqual([
      'name',
      'team',
      'jerseyName',
      'initials',
      'jerseyNumber',
    ]);
  });

  it('getPersonMatrixIdentityPrefForList reads per-list prefs', () => {
    const settings = {
      personMatrixIdentityByList: {
        '2': {
          order: ['jerseyNumber', 'name', 'initials', 'team', 'jerseyName'],
          hidden: ['team'],
        },
      },
    };
    const pref = getPersonMatrixIdentityPrefForList(settings, '2');
    expect(pref.order[0]).toBe('jerseyNumber');
    expect(pref.hidden).toEqual(['team']);
  });

  it('updates per-list map and compares prefs', () => {
    const base = getPersonMatrixIdentityPrefForList(null, '9');
    const hidden = setPersonMatrixIdentityColumnHidden(base, 'team', true);
    expect(personMatrixIdentityColumnsEqual(base, hidden)).toBe(false);
    const shown = setPersonMatrixIdentityColumnHidden(hidden, 'team', false);
    expect(personMatrixIdentityColumnsEqual(base, shown)).toBe(true);
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
