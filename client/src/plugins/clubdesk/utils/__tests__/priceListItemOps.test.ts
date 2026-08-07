import { copyItemAt, groupItemsByCategory, reorderItems } from '../priceListItemOps';

function items(...rows: Array<{ title: string; category?: string | null; price?: number }>) {
  return rows.map((row, i) => ({
    title: row.title,
    description: null as string | null,
    price: row.price ?? 10,
    category: row.category === undefined ? null : row.category,
    sequenceOrder: i + 1,
  }));
}

describe('reorderItems', () => {
  it('moves an item down within the same category and renumbers', () => {
    const list = items(
      { title: 'A', category: 'Drinks' },
      { title: 'B', category: 'Drinks' },
      { title: 'C', category: 'Food' },
    );
    // Fix per-category sequence
    list[0].sequenceOrder = 1;
    list[1].sequenceOrder = 2;
    list[2].sequenceOrder = 1;

    const result = reorderItems(list, 0, 1);
    expect(result?.map((s) => s.title)).toEqual(['B', 'A', 'C']);
    expect(result?.find((s) => s.title === 'B')?.sequenceOrder).toBe(1);
    expect(result?.find((s) => s.title === 'A')?.sequenceOrder).toBe(2);
    expect(result?.find((s) => s.title === 'C')?.sequenceOrder).toBe(1);
  });

  it('returns null when moving past category bounds', () => {
    const list = items({ title: 'A', category: 'Drinks' }, { title: 'B', category: 'Food' });
    list[0].sequenceOrder = 1;
    list[1].sequenceOrder = 1;
    expect(reorderItems(list, 0, -1)).toBeNull();
    expect(reorderItems(list, 0, 1)).toBeNull();
  });
});

describe('copyItemAt', () => {
  it('inserts a copy after the source and renumbers within category', () => {
    const source = items(
      { title: 'A', category: 'Drinks', price: 5 },
      { title: 'B', category: 'Food' },
    );
    source[0].sequenceOrder = 1;
    source[1].sequenceOrder = 1;

    const result = copyItemAt(source, 0);
    expect(result).toHaveLength(3);
    expect(result?.[0].title).toBe('A');
    expect(result?.[1]).toMatchObject({
      title: 'A',
      price: 5,
      category: 'Drinks',
      sequenceOrder: 2,
    });
    expect(result?.[2]).toMatchObject({ title: 'B', sequenceOrder: 1 });
  });

  it('returns null for a missing index', () => {
    expect(copyItemAt(items({ title: 'A' }), 3)).toBeNull();
  });
});

describe('groupItemsByCategory', () => {
  it('groups and sorts by sequenceOrder, respecting catalog order', () => {
    const list = [
      { title: 'Tea', description: null, price: 1, category: 'Drinks', sequenceOrder: 2 },
      { title: 'Soup', description: null, price: 2, category: 'Food', sequenceOrder: 1 },
      { title: 'Coffee', description: null, price: 3, category: 'Drinks', sequenceOrder: 1 },
    ];
    const groups = groupItemsByCategory(list, ['Food', 'Drinks']);
    expect(groups.map((g) => g.category)).toEqual(['Food', 'Drinks']);
    expect(groups[1].items.map((i) => i.title)).toEqual(['Coffee', 'Tea']);
  });
});
