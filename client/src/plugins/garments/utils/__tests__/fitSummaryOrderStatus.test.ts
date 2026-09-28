import type { GarmentList, GarmentPerson, InventoryItem } from '../../types/garments';
import { classifyFitSummaryBreakdown, collectFitSummaryOrderLines } from '../fitSummaryOrderStatus';

function person(partial: Partial<GarmentPerson> & Pick<GarmentPerson, 'id'>): GarmentPerson {
  return {
    listId: '1',
    name: partial.id,
    shirtSize: null,
    shortsSize: null,
    socksSize: null,
    jerseyNumber: null,
    jerseyName: null,
    initials: null,
    comment: null,
    contactId: null,
    teamId: null,
    checkboxValues: {},
    ctSizes: {},
    ctAudiences: {},
    sortOrder: 0,
    ...partial,
  };
}

const inventory: InventoryItem[] = [
  {
    id: '7',
    articleName: 'Matchtröja',
    brand: '',
    description: '',
    material: '',
    purchasePrice: null,
    recommendedPrice: null,
    salePrice: null,
    currency: 'SEK',
    comment: '',
    tags: [],
    variants: [],
    totalQuantity: 0,
    variantCount: 0,
    createdAt: '',
    updatedAt: '',
  },
];

function list(partial: Partial<GarmentList> & Pick<GarmentList, 'id' | 'name'>): GarmentList {
  return {
    teamId: null,
    checkboxColumns: [{ id: 'person_betalt', label: 'Paid', sortOrder: 0 }],
    assignedInventoryItemIds: ['7'],
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('classifyFitSummaryBreakdown', () => {
  it('treats an unchecked row as not ordered', () => {
    expect(classifyFitSummaryBreakdown({ count: 7, ordered: false, qtyOrdered: null })).toBe(
      'not_ordered',
    );
  });

  it('treats ordered with a short qty as incomplete', () => {
    expect(classifyFitSummaryBreakdown({ count: 2, ordered: true, qtyOrdered: 1 })).toBe(
      'incomplete',
    );
  });

  it('treats ordered qty that covers the need as finished', () => {
    expect(classifyFitSummaryBreakdown({ count: 2, ordered: true, qtyOrdered: 2 })).toBe(
      'finished',
    );
    expect(classifyFitSummaryBreakdown({ count: 2, ordered: true, qtyOrdered: 3 })).toBe(
      'finished',
    );
  });

  it('treats a checked row with no qty as incomplete', () => {
    expect(classifyFitSummaryBreakdown({ count: 2, ordered: true, qtyOrdered: null })).toBe(
      'incomplete',
    );
  });
});

describe('collectFitSummaryOrderLines', () => {
  it('counts summary rows per list', () => {
    const lines = collectFitSummaryOrderLines(
      [
        list({
          id: '1',
          name: 'P15',
          persons: [
            person({ id: 'a', ctSizes: { '7': 'M' }, ctAudiences: { '7': 'Senior' } }),
            person({ id: 'b', ctSizes: { '7': 'M' }, ctAudiences: { '7': 'Senior' } }),
            person({ id: 'c', ctSizes: { '7': 'L' }, ctAudiences: { '7': 'Senior' } }),
          ],
          fitSummaryProcurement: {
            '7': {
              'Senior\u001fM': { ordered: true, qtyOrdered: 1 },
              'Senior\u001fL': { ordered: false },
            },
          },
        }),
        list({
          id: '2',
          name: 'F16',
          persons: [
            person({ id: 'd', listId: '2', ctSizes: { '7': 'S' }, ctAudiences: { '7': 'Senior' } }),
            person({ id: 'e', listId: '2', ctSizes: { '7': 'S' }, ctAudiences: { '7': 'Senior' } }),
          ],
          fitSummaryProcurement: {
            '7': {
              'Senior\u001fS': { ordered: true, qtyOrdered: 2 },
            },
          },
        }),
      ],
      inventory,
    );

    const byStatus = (status: string) => lines.filter((line) => line.status === status);
    expect(byStatus('finished')).toEqual([
      expect.objectContaining({
        listName: 'F16',
        articleName: 'Matchtröja',
        audience: 'Senior',
        size: 'S',
        needed: 2,
        qtyOrdered: 2,
      }),
    ]);
    expect(byStatus('incomplete')).toEqual([
      expect.objectContaining({
        listName: 'P15',
        size: 'M',
        needed: 2,
        qtyOrdered: 1,
      }),
    ]);
    expect(byStatus('not_ordered')).toEqual([
      expect.objectContaining({
        listName: 'P15',
        size: 'L',
        needed: 1,
        qtyOrdered: 0,
      }),
    ]);
  });
});
