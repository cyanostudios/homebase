import { compareClubdesksByField, isClubdeskStringSortField } from '../clubdeskListSort';
import type { Clubdesk } from '../../types/clubdesk';

function makeClubdesk(partial: Partial<Clubdesk>): Clubdesk {
  return {
    id: '1',
    title: 'A',
    slug: 'a',
    description: null,
    featuredImageUrl: null,
    category: null,
    publicationStatus: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...partial,
  };
}

describe('compareClubdesksByField', () => {
  it('sorts by title ascending', () => {
    const a = makeClubdesk({ id: '1', title: 'Beta' });
    const b = makeClubdesk({ id: '2', title: 'Alpha' });
    expect(compareClubdesksByField(a, b, 'title', 'asc')).toBeGreaterThan(0);
    expect(compareClubdesksByField(a, b, 'title', 'desc')).toBeLessThan(0);
  });

  it('sorts by publicationStatus', () => {
    const draft = makeClubdesk({ publicationStatus: 'draft' });
    const published = makeClubdesk({ publicationStatus: 'published' });
    expect(compareClubdesksByField(draft, published, 'publicationStatus', 'asc')).toBeLessThan(0);
  });

  it('detects string sort fields', () => {
    expect(isClubdeskStringSortField('title')).toBe(true);
    expect(isClubdeskStringSortField('updatedAt')).toBe(false);
  });
});
