const fs = require('fs');
const path = require('path');

const clubdeskSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskListItem.tsx'), 'utf8');
const priceListSrc = fs.readFileSync(path.join(__dirname, '../PriceListListItem.tsx'), 'utf8');

describe.each([
  ['ClubdeskListItem', clubdeskSrc],
  ['PriceListListItem', priceListSrc],
])('%s reorder layout', (_name, src) => {
  test('places up/down arrows horizontally, after status and featured selects', () => {
    expect(src).toMatch(/className="flex flex-row items-center gap-0\.5"/);
    expect(src).not.toMatch(/className="flex flex-col gap-0\.5"/);

    const statusIdx = src.indexOf('{onStatusChange ? (');
    const featuredIdx = src.indexOf('{onFeaturedChange ? (');
    const reorderIdx = src.indexOf('{canReorder ? (');
    expect(statusIdx).toBeGreaterThan(-1);
    expect(featuredIdx).toBeGreaterThan(-1);
    expect(reorderIdx).toBeGreaterThan(-1);
    expect(statusIdx).toBeLessThan(featuredIdx);
    expect(featuredIdx).toBeLessThan(reorderIdx);
  });
});

describe.each([
  ['ClubdeskListItem', clubdeskSrc],
  ['PriceListListItem', priceListSrc],
])('%s featured quick option', (_name, src) => {
  test('exposes featured select bound to onFeaturedChange', () => {
    expect(src).toMatch(/onFeaturedChange/);
    expect(src).toMatch(/clubdesk\.featuredShort/);
    expect(src).toMatch(/clubdesk\.notFeatured/);
  });
});
