import { ctFieldPatch, isCtSizeIncompatible } from '../ctFieldPatch';

describe('ctFieldPatch', () => {
  it('sets a non-empty trimmed value for one item', () => {
    expect(ctFieldPatch('10', '  M  ')).toEqual({ '10': 'M' });
  });

  it('sends empty string to clear (does not omit the key)', () => {
    expect(ctFieldPatch('10', '  ')).toEqual({ '10': '' });
  });
});

describe('isCtSizeIncompatible', () => {
  it('is true when size is set and not allowed', () => {
    expect(isCtSizeIncompatible('M', ['S', 'L'])).toBe(true);
  });

  it('is false when size is still allowed', () => {
    expect(isCtSizeIncompatible('M', ['S', 'M'])).toBe(false);
  });

  it('is false when size is empty', () => {
    expect(isCtSizeIncompatible('', [])).toBe(false);
    expect(isCtSizeIncompatible('  ', ['S'])).toBe(false);
  });
});
