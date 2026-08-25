const TeamModel = require('../model');

const { sanitizePlayerCountHistory, seedPlayerCountHistory, appendPlayerCountHistory } = TeamModel;

describe('player_count_history helpers', () => {
  test('sanitizePlayerCountHistory keeps valid entries and clamps count', () => {
    expect(
      sanitizePlayerCountHistory([
        { at: '2026-01-01T00:00:00.000Z', count: 12 },
        { at: '', count: 3 },
        { at: '2026-02-01T00:00:00.000Z', count: -5 },
        { at: '2026-03-01T00:00:00.000Z', count: 99999 },
      ]),
    ).toEqual([
      { at: '2026-01-01T00:00:00.000Z', count: 12 },
      { at: '2026-02-01T00:00:00.000Z', count: 0 },
      { at: '2026-03-01T00:00:00.000Z', count: 9999 },
    ]);
  });

  test('seedPlayerCountHistory creates a single point', () => {
    expect(seedPlayerCountHistory(17, '2026-08-01T12:00:00.000Z')).toEqual([
      { at: '2026-08-01T12:00:00.000Z', count: 17 },
    ]);
  });

  test('appendPlayerCountHistory appends only when count changes', () => {
    const existing = [{ at: '2026-01-01T00:00:00.000Z', count: 15 }];
    expect(appendPlayerCountHistory(existing, 15, '2026-08-01T00:00:00.000Z')).toEqual(existing);
    expect(appendPlayerCountHistory(existing, 18, '2026-08-01T00:00:00.000Z')).toEqual([
      { at: '2026-01-01T00:00:00.000Z', count: 15 },
      { at: '2026-08-01T00:00:00.000Z', count: 18 },
    ]);
  });

  test('appendPlayerCountHistory seeds when empty', () => {
    expect(appendPlayerCountHistory([], 10, '2026-08-01T00:00:00.000Z')).toEqual([
      { at: '2026-08-01T00:00:00.000Z', count: 10 },
    ]);
  });
});
