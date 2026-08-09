import {
  getInitialInstructionListViewMode,
  isInstructionListViewMode,
  resolveInstructionListViewMode,
} from '../instructionListViewMode';

describe('resolveInstructionListViewMode', () => {
  it('uses listViewMode when valid', () => {
    expect(resolveInstructionListViewMode({ listViewMode: 'table' })).toBe('table');
    expect(resolveInstructionListViewMode({ listViewMode: 'cards' })).toBe('cards');
  });

  it('defaults to cards', () => {
    expect(resolveInstructionListViewMode(null)).toBe('cards');
    expect(resolveInstructionListViewMode({})).toBe('cards');
    expect(resolveInstructionListViewMode({ listViewMode: 'grid' })).toBe('cards');
  });
});

describe('isInstructionListViewMode', () => {
  it('accepts only cards and table', () => {
    expect(isInstructionListViewMode('cards')).toBe(true);
    expect(isInstructionListViewMode('table')).toBe(true);
    expect(isInstructionListViewMode('grid')).toBe(false);
  });
});

describe('getInitialInstructionListViewMode', () => {
  it('defaults to cards when window is unavailable or empty', () => {
    expect(getInitialInstructionListViewMode()).toBe('cards');
  });
});
