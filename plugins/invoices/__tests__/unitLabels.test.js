const { formatUnitLabelSv, isSingularQuantity } = require('../unitLabels');

describe('unitLabels', () => {
  test('isSingularQuantity only for ±1', () => {
    expect(isSingularQuantity(1)).toBe(true);
    expect(isSingularQuantity(-1)).toBe(true);
    expect(isSingularQuantity(0)).toBe(false);
    expect(isSingularQuantity(2)).toBe(false);
  });

  test('formatUnitLabelSv pluralizes known units', () => {
    expect(formatUnitLabelSv('month', 1)).toBe('Månad');
    expect(formatUnitLabelSv('month', 2)).toBe('Månader');
    expect(formatUnitLabelSv('hour', 1)).toBe('Timme');
    expect(formatUnitLabelSv('hour', 5)).toBe('Timmar');
    expect(formatUnitLabelSv('week', 0)).toBe('Veckor');
  });
});
