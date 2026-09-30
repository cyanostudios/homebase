import { inventoryIdsForPublicationStatus } from '../inventoryBulkStatus';

const items = [
  { id: '1', publicationStatus: 'published' },
  { id: '2', publicationStatus: 'draft' },
  { id: '3', publicationStatus: 'published' },
];

describe('inventoryIdsForPublicationStatus', () => {
  it('returns only selected articles that are not already the target status', () => {
    expect(inventoryIdsForPublicationStatus(items, ['1', '2', '3'], 'draft')).toEqual(['1', '3']);
    expect(inventoryIdsForPublicationStatus(items, ['2'], 'draft')).toEqual([]);
  });

  it('ignores ids that are not in the catalog', () => {
    expect(inventoryIdsForPublicationStatus(items, ['9', '2'], 'published')).toEqual(['2']);
  });
});
