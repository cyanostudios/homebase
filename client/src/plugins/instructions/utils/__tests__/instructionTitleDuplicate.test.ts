import { hasDuplicateInstructionTitle } from '../instructionTitleDuplicate';

const rows = [
  { id: '1', title: 'Brew' },
  { id: '2', title: 'Clean Machine' },
];

describe('hasDuplicateInstructionTitle', () => {
  it('detects case-insensitive duplicates', () => {
    expect(hasDuplicateInstructionTitle(rows, 'brew')).toBe(true);
    expect(hasDuplicateInstructionTitle(rows, '  BREW  ')).toBe(true);
  });

  it('ignores the excluded instruction id (update path)', () => {
    expect(hasDuplicateInstructionTitle(rows, 'Brew', '1')).toBe(false);
  });

  it('still flags another row when excludeId is set', () => {
    expect(hasDuplicateInstructionTitle(rows, 'Clean Machine', '1')).toBe(true);
  });

  it('returns false for empty title or no match', () => {
    expect(hasDuplicateInstructionTitle(rows, '   ')).toBe(false);
    expect(hasDuplicateInstructionTitle(rows, 'New Guide')).toBe(false);
  });
});
