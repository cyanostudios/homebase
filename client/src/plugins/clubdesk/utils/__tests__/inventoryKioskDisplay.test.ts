import {
  formatInventoryPackageSize,
  formatInventoryPickerSecondaryMeta,
  inventoryMatchesPickerSearch,
  inventoryPickerSearchHaystack,
} from '../inventoryKioskDisplay';

describe('inventoryKioskDisplay', () => {
  const row = {
    articleName: 'Milk 3%',
    brand: 'Arla',
    category: 'Dairy',
    packageSize: '1',
    packageUnit: 'L',
  };

  test('formatInventoryPackageSize joins size and unit with one space', () => {
    expect(formatInventoryPackageSize('1', 'L')).toBe('1 L');
    expect(formatInventoryPackageSize('500', '')).toBe('500');
    expect(formatInventoryPackageSize('', 'g')).toBe('g');
    expect(formatInventoryPackageSize('', '')).toBe('');
  });

  test('formatInventoryPickerSecondaryMeta omits empty segments', () => {
    expect(formatInventoryPickerSecondaryMeta(row)).toBe('Arla · Dairy · 1 L');
    expect(
      formatInventoryPickerSecondaryMeta({
        brand: '',
        category: 'Snacks',
        packageSize: '',
        packageUnit: '',
      }),
    ).toBe('Snacks');
  });

  test('inventory picker search includes formatted package not provenance fields', () => {
    const hay = inventoryPickerSearchHaystack(row);
    expect(hay).toContain('milk 3%');
    expect(hay).toContain('dairy');
    expect(hay).toContain('1 l');
    expect(inventoryMatchesPickerSearch(row, '1 l')).toBe(true);
    expect(inventoryMatchesPickerSearch(row, 'kiosk-seed')).toBe(false);
  });
});
