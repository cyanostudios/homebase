// plugins/garments/__tests__/normalizeCheckboxColumns.test.js
const GarmentsModel = require('../model');

// Re-test via transform helpers by creating model and calling transform methods
describe('GarmentsModel transforms', () => {
  const model = new GarmentsModel();

  it('transforms list row with checkbox columns', () => {
    const list = model.transformListRow({
      id: 1,
      name: 'P2015',
      team_id: 5,
      checkbox_columns: JSON.stringify([
        { id: 'a', label: 'Betalt', sortOrder: 0 },
        { id: 'b', label: 'Tröja Beställt', sort_order: 1 },
      ]),
      person_count: 3,
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
    });
    expect(list.id).toBe('1');
    expect(list.teamId).toBe('5');
    expect(list.personCount).toBe(3);
    expect(list.checkboxColumns).toHaveLength(2);
    expect(list.checkboxColumns[0]).toEqual({ id: 'a', label: 'Betalt', sortOrder: 0 });
    expect(list.checkboxColumns[1].sortOrder).toBe(1);
  });

  it('transforms person and filters checkbox values to allowed ids', () => {
    const person = model.transformPersonRow(
      {
        id: 9,
        list_id: 1,
        name: 'Ada',
        shirt_size: '152',
        shorts_size: null,
        socks_size: '2',
        jersey_number: '7',
        comment: 'note',
        checkbox_values: { a: true, stale: true },
        sort_order: 0,
        created_at: null,
        updated_at: null,
      },
      ['a'],
    );
    expect(person.checkboxValues).toEqual({ a: true });
    expect(person.shirtSize).toBe('152');
    expect(person.jerseyNumber).toBe('7');
  });

  it('transforms inventory row', () => {
    const item = model.transformInventoryRow({
      id: 2,
      article_name: 'Strumpor',
      brand: 'Stadium',
      size: '35-38',
      quantity: 12,
      comment: 'Hylla A',
      created_at: null,
      updated_at: null,
    });
    expect(item).toMatchObject({
      id: '2',
      articleName: 'Strumpor',
      brand: 'Stadium',
      size: '35-38',
      quantity: 12,
      comment: 'Hylla A',
    });
  });
});
