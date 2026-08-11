jest.mock('@/core/utils/textUtils', () => ({
  stripHtml: (html: string) =>
    String(html || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
}));

import {
  noteHasContent,
  noteHasMentions,
  noteIsRecentlyUpdated,
  noteMatchesListFilters,
  toggleNoteListFilter,
} from '../noteListFilter';

const NOW = Date.parse('2026-08-07T12:00:00.000Z');

const base = {
  mentions: [] as {
    contactId: string;
    contactName: string;
    companyName: string;
    position: number;
    length: number;
  }[],
  content: '',
  updatedAt: new Date(NOW),
};

describe('noteListFilter', () => {
  it('detects mentions, content, and recent updates', () => {
    expect(noteHasMentions(base)).toBe(false);
    expect(
      noteHasMentions({
        ...base,
        mentions: [{ contactId: '1', contactName: 'A', companyName: '', position: 0, length: 1 }],
      }),
    ).toBe(true);
    expect(noteHasContent({ content: '<p>hi</p>' })).toBe(true);
    expect(noteHasContent({ content: '<p>  </p>' })).toBe(false);
    expect(noteIsRecentlyUpdated({ updatedAt: new Date(NOW - 2 * 24 * 60 * 60 * 1000) }, NOW)).toBe(
      true,
    );
    expect(
      noteIsRecentlyUpdated({ updatedAt: new Date(NOW - 10 * 24 * 60 * 60 * 1000) }, NOW),
    ).toBe(false);
  });

  it('ANDs facets; empty selection matches all', () => {
    const note = {
      ...base,
      content: '<p>body</p>',
      mentions: [{ contactId: '1', contactName: 'A', companyName: '', position: 0, length: 1 }],
    };
    expect(noteMatchesListFilters(note, [], NOW)).toBe(true);
    expect(noteMatchesListFilters(note, ['withMentions', 'withContent'], NOW)).toBe(true);
    expect(noteMatchesListFilters(base, ['withMentions', 'withContent'], NOW)).toBe(false);
  });

  it('toggles facets independently', () => {
    expect(toggleNoteListFilter([], 'withMentions')).toEqual(['withMentions']);
    expect(toggleNoteListFilter(['withMentions'], 'withContent')).toEqual([
      'withMentions',
      'withContent',
    ]);
    expect(toggleNoteListFilter(['withMentions', 'withContent'], 'withMentions')).toEqual([
      'withContent',
    ]);
  });
});
