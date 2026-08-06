import { compareInstructionsByField, isInstructionStringSortField } from '../instructionListSort';
import type { Instruction } from '../../types/instructions';

function makeInstruction(partial: Partial<Instruction>): Instruction {
  return {
    id: '1',
    title: 'A',
    slug: 'a',
    description: null,
    featuredImageUrl: null,
    category: null,
    publicationStatus: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...partial,
  };
}

describe('compareInstructionsByField', () => {
  it('sorts by title ascending', () => {
    const a = makeInstruction({ id: '1', title: 'Beta' });
    const b = makeInstruction({ id: '2', title: 'Alpha' });
    expect(compareInstructionsByField(a, b, 'title', 'asc')).toBeGreaterThan(0);
    expect(compareInstructionsByField(a, b, 'title', 'desc')).toBeLessThan(0);
  });

  it('sorts by publicationStatus', () => {
    const draft = makeInstruction({ publicationStatus: 'draft' });
    const published = makeInstruction({ publicationStatus: 'published' });
    expect(compareInstructionsByField(draft, published, 'publicationStatus', 'asc')).toBeLessThan(
      0,
    );
  });

  it('detects string sort fields', () => {
    expect(isInstructionStringSortField('title')).toBe(true);
    expect(isInstructionStringSortField('updatedAt')).toBe(false);
  });
});
