import { compareNotesByField, isNoteAscDefaultField, isNoteStringSortField } from '../noteListSort';

const base = {
  title: 'Alpha',
  createdAt: new Date(2026, 6, 1),
  updatedAt: new Date(2026, 6, 10, 8, 0, 0),
  mentions: [] as { contactId: string; contactName: string }[],
};

describe('noteListSort', () => {
  it('sorts titles ascending', () => {
    expect(
      compareNotesByField({ ...base, title: 'A' }, { ...base, title: 'B' }, 'title', 'asc'),
    ).toBeLessThan(0);
  });

  it('sorts by mentions count', () => {
    const few = { ...base, mentions: [{ contactId: '1', contactName: 'A' }] };
    const many = {
      ...base,
      mentions: [
        { contactId: '1', contactName: 'A' },
        { contactId: '2', contactName: 'B' },
      ],
    };
    expect(compareNotesByField(few, many, 'mentions', 'asc')).toBeLessThan(0);
  });

  it('isNoteStringSortField', () => {
    expect(isNoteStringSortField('title')).toBe(true);
    expect(isNoteStringSortField('updatedAt')).toBe(false);
  });

  it('defaults mentions magnitude to descending', () => {
    expect(isNoteAscDefaultField('title')).toBe(true);
    expect(isNoteAscDefaultField('mentions')).toBe(false);
    expect(isNoteAscDefaultField('updatedAt')).toBe(false);
  });
});
