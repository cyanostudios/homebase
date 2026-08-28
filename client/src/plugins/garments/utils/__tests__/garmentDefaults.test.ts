import { createDefaultCheckboxColumns } from '../defaultCheckboxTemplate';
import {
  findDuplicateJerseyNumbers,
  getMasterCheckboxState,
  getPersonCompletionStatus,
  personCompletionDotClass,
  personsWithEditingJersey,
  setCheckboxValuesForIds,
  toggleCheckboxValue,
} from '../garmentListFilter';

describe('createDefaultCheckboxColumns', () => {
  it('includes only person-level Paid (inventory groups added via Settings)', () => {
    const cols = createDefaultCheckboxColumns();
    expect(cols).toHaveLength(1);
    expect(cols[0]).toEqual({
      id: 'person_betalt',
      label: 'Paid',
      sortOrder: 0,
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

describe('setCheckboxValuesForIds / getMasterCheckboxState', () => {
  const ids = ['shorts_bestallt', 'troja_bestallt', 'strumpor_bestallt'];

  it('sets all ids to the same value', () => {
    expect(setCheckboxValuesForIds({ shorts_bestallt: true }, ids, true)).toEqual({
      shorts_bestallt: true,
      troja_bestallt: true,
      strumpor_bestallt: true,
    });
    expect(setCheckboxValuesForIds({ shorts_bestallt: true }, ids, false)).toEqual({
      shorts_bestallt: false,
      troja_bestallt: false,
      strumpor_bestallt: false,
    });
  });

  it('reports empty, partial (indeterminate), and complete master states', () => {
    expect(getMasterCheckboxState({}, ids)).toEqual({ checked: false, indeterminate: false });
    expect(getMasterCheckboxState({ shorts_bestallt: true }, ids)).toEqual({
      checked: false,
      indeterminate: true,
    });
    expect(
      getMasterCheckboxState(
        { shorts_bestallt: true, troja_bestallt: true, strumpor_bestallt: true },
        ids,
      ),
    ).toEqual({ checked: true, indeterminate: false });
  });
});

describe('getPersonCompletionStatus', () => {
  const cols = ['person_betalt', 'shorts_bestallt'];

  it('returns empty when nothing is filled', () => {
    expect(
      getPersonCompletionStatus({
        jerseyName: '',
        initials: null,
        checkboxValues: {},
        checkboxColumnIds: cols,
      }),
    ).toBe('empty');
  });

  it('returns partial when only some fields are filled', () => {
    expect(
      getPersonCompletionStatus({
        jerseyName: 'ANDERSSON',
        initials: '',
        checkboxValues: { person_betalt: true },
        checkboxColumnIds: cols,
      }),
    ).toBe('partial');
  });

  it('returns complete when text fields and all checkboxes are filled', () => {
    expect(
      getPersonCompletionStatus({
        jerseyName: 'ANDERSSON',
        initials: 'KA',
        checkboxValues: { person_betalt: true, shorts_bestallt: true },
        checkboxColumnIds: cols,
      }),
    ).toBe('complete');
  });
});

describe('personCompletionDotClass', () => {
  it('maps status to contact-style traffic-light classes', () => {
    expect(personCompletionDotClass('empty')).toBe('bg-red-500');
    expect(personCompletionDotClass('partial')).toBe('bg-amber-500');
    expect(personCompletionDotClass('complete')).toBe('bg-emerald-500');
  });
});
