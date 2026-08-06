import { copyStepAt, reorderSteps } from '../instructionStepOps';

function steps(...titles: string[]) {
  return titles.map((title, i) => ({
    title,
    description: null as string | null,
    sequenceOrder: i + 1,
    imageUrl: null as string | null,
  }));
}

describe('reorderSteps', () => {
  it('moves a step down and renumbers sequenceOrder', () => {
    const result = reorderSteps(steps('A', 'B', 'C'), 0, 1);
    expect(result?.map((s) => s.title)).toEqual(['B', 'A', 'C']);
    expect(result?.map((s) => s.sequenceOrder)).toEqual([1, 2, 3]);
  });

  it('moves a step up and renumbers sequenceOrder', () => {
    const result = reorderSteps(steps('A', 'B', 'C'), 2, -1);
    expect(result?.map((s) => s.title)).toEqual(['A', 'C', 'B']);
    expect(result?.map((s) => s.sequenceOrder)).toEqual([1, 2, 3]);
  });

  it('returns null when moving past the start or end', () => {
    expect(reorderSteps(steps('A', 'B'), 0, -1)).toBeNull();
    expect(reorderSteps(steps('A', 'B'), 1, 1)).toBeNull();
  });
});

describe('copyStepAt', () => {
  it('inserts a copy after the source and renumbers', () => {
    const source = [
      { title: 'A', description: 'd', sequenceOrder: 1, imageUrl: '/a.png' },
      { title: 'B', description: null, sequenceOrder: 2, imageUrl: null },
    ];
    const result = copyStepAt(source, 0);
    expect(result).toHaveLength(3);
    expect(result?.[0]).toEqual(source[0]);
    expect(result?.[1]).toEqual({
      title: 'A',
      description: 'd',
      sequenceOrder: 2,
      imageUrl: '/a.png',
    });
    expect(result?.[2]).toMatchObject({ title: 'B', sequenceOrder: 3 });
  });

  it('returns null for a missing index', () => {
    expect(copyStepAt(steps('A'), 3)).toBeNull();
  });
});
