const {
  addItem,
  decrementItem,
  clearCart,
  getCart,
  setCart,
  total,
  uniqueCount,
  formatMoney,
  lineKey,
  groupCartByCategoryOrder,
} = require('../lib/priceListCart');

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

describe('ClubdeskPriceListCart', () => {
  const slug = 'bar-menu';
  let store;

  beforeEach(() => {
    store = memoryStorage();
  });

  test('addItem increases qty for same line', () => {
    const line = { title: 'Beer', price: 45, category: 'Drinks' };
    addItem(slug, line, store);
    const cart = addItem(slug, line, store);
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(2);
    expect(cart[0].id).toBe(lineKey(line));
  });

  test('decrementItem removes row at qty 0', () => {
    const line = { id: 'a', title: 'Beer', price: 45, category: 'Drinks' };
    addItem(slug, line, store);
    let cart = decrementItem(slug, 'a', store);
    expect(cart).toHaveLength(0);
    expect(getCart(slug, store)).toEqual([]);
  });

  test('decrementItem reduces qty without removing above zero', () => {
    const line = { id: 'a', title: 'Beer', price: 45, category: 'Drinks' };
    addItem(slug, line, store);
    addItem(slug, line, store);
    const cart = decrementItem(slug, 'a', store);
    expect(cart).toEqual([expect.objectContaining({ id: 'a', qty: 1, price: 45 })]);
  });

  test('clearCart empties storage for slug', () => {
    const line = { id: 'a', title: 'Beer', price: 45, category: 'Drinks' };
    addItem(slug, line, store);
    addItem(slug, line, store);
    expect(getCart(slug, store)).toHaveLength(1);
    const cart = clearCart(slug, store);
    expect(cart).toEqual([]);
    expect(getCart(slug, store)).toEqual([]);
  });

  test('total sums price times qty', () => {
    expect(
      total([
        { price: 45, qty: 2 },
        { price: 10.5, qty: 1 },
      ]),
    ).toBe(100.5);
  });

  test('uniqueCount ignores empty cart', () => {
    expect(uniqueCount([])).toBe(0);
    expect(uniqueCount([{ qty: 2 }, { qty: 1 }])).toBe(2);
  });

  test('setCart drops zero-qty rows', () => {
    const cart = setCart(
      slug,
      [
        { id: 'a', title: 'A', price: 1, qty: 0 },
        { id: 'b', title: 'B', price: 2, qty: 3 },
      ],
      store,
    );
    expect(cart).toHaveLength(1);
    expect(cart[0].id).toBe('b');
  });

  test('formatMoney uses currency style when possible', () => {
    const formatted = formatMoney(45, 'SEK', 'sv-SE');
    expect(formatted).toMatch(/45/);
    expect(formatted.toLowerCase()).toMatch(/kr|sek/);
  });

  test('groupCartByCategoryOrder follows price list category order, not add order', () => {
    const cart = [
      { id: 'line-2', title: 'Fanta', price: 20, qty: 1, category: 'Övrigt' },
      { id: 'line-0', title: 'Cola', price: 20, qty: 1, category: 'Dricka' },
      { id: 'line-1', title: 'Chips', price: 15, qty: 1, category: 'Snacks' },
    ];
    const grouped = groupCartByCategoryOrder(
      cart,
      ['Dricka', 'Snacks', 'Övrigt'],
      ['line-0', 'line-1', 'line-2'],
    );
    expect(grouped.map(([cat]) => cat)).toEqual(['Dricka', 'Snacks', 'Övrigt']);
    expect(grouped[0][1].map((i) => i.id)).toEqual(['line-0']);
  });

  test('groupCartByCategoryOrder appends unknown categories after list order', () => {
    const cart = [
      { id: 'x', title: 'X', price: 1, qty: 1, category: 'Ny' },
      { id: 'a', title: 'A', price: 1, qty: 1, category: 'Dricka' },
    ];
    const grouped = groupCartByCategoryOrder(cart, ['Dricka', 'Snacks']);
    expect(grouped.map(([cat]) => cat)).toEqual(['Dricka', 'Ny']);
  });
});
