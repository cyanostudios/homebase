const {
  listReorderViewTransitionName,
  runListReorderTransition,
} = require('../listReorderTransition');

describe('listReorderTransition', () => {
  test('listReorderViewTransitionName sanitizes ids', () => {
    expect(listReorderViewTransitionName('abc-123')).toBe('list-reorder-abc-123');
    expect(listReorderViewTransitionName('a/b c!')).toBe('list-reorder-abc');
    expect(listReorderViewTransitionName('')).toBe('list-reorder-row');
  });

  test('runListReorderTransition invokes update', () => {
    const update = jest.fn();
    runListReorderTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
