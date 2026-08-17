import { createDefaultCheckboxColumns } from '../defaultCheckboxTemplate';
import {
  findDuplicateJerseyNumbers,
  personsWithEditingJersey,
  toggleCheckboxValue,
} from '../garmentListFilter';

describe('createDefaultCheckboxColumns', () => {
  it('includes base labels and garment state columns with unique ids', () => {
    const cols = createDefaultCheckboxColumns();
    expect(cols).toHaveLength(12);
    expect(cols.map((c) => c.label)).toEqual([
      'Betalt',
      'SvFF-blankett',
      'FOGIS-reg.',
      'Tröja Beställt',
      'Tröja Levererat',
      'Tröja Utdelat',
      'Shorts Beställt',
      'Shorts Levererat',
      'Shorts Utdelat',
      'Strumpor Beställt',
      'Strumpor Levererat',
      'Strumpor Utdelat',
    ]);
    const ids = new Set(cols.map((c) => c.id));
    expect(ids.size).toBe(12);
    cols.forEach((col, index) => {
      expect(col.sortOrder).toBe(index);
    });
  });
});

describe('findDuplicateJerseyNumbers', () => {
  it('flags soft duplicates without empty numbers', () => {
    const dupes = findDuplicateJerseyNumbers([
      { id: '1', jerseyNumber: '10' },
      { id: '2', jerseyNumber: '10' },
      { id: '3', jerseyNumber: '7' },
      { id: '4', jerseyNumber: '' },
      { id: '5', jerseyNumber: null },
    ]);
    expect(dupes.has('1')).toBe(true);
    expect(dupes.has('2')).toBe(true);
    expect(dupes.has('3')).toBe(false);
    expect(dupes.has('4')).toBe(false);
  });
});

describe('personsWithEditingJersey', () => {
  it('overlays the in-progress jersey on the editing person only', () => {
    const persons = [
      { id: '1', jerseyNumber: '10' },
      { id: '2', jerseyNumber: '7' },
    ];
    const overlaid = personsWithEditingJersey(persons, '2', '10');
    expect(findDuplicateJerseyNumbers(overlaid).has('1')).toBe(true);
    expect(findDuplicateJerseyNumbers(overlaid).has('2')).toBe(true);
    expect(personsWithEditingJersey(persons, null, '10')[1].jerseyNumber).toBe('7');
  });
});

describe('toggleCheckboxValue', () => {
  it('turns a missing key on and an existing true key off', () => {
    expect(toggleCheckboxValue(undefined, 'a')).toEqual({ a: true });
    expect(toggleCheckboxValue({ a: true, b: false }, 'a')).toEqual({ a: false, b: false });
    expect(toggleCheckboxValue({ b: false }, 'a')).toEqual({ b: false, a: true });
  });
});
