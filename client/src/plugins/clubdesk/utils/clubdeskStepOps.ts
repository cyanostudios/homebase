/** Shared pure step list mutations used by form (local) and detail view (persist). */

export type StepLike = {
  title: string;
  description: string | null;
  sequenceOrder: number;
  imageUrl: string | null;
};

/**
 * Move a step by one position. Returns null when the move is out of bounds.
 */
export function reorderSteps<T extends StepLike>(
  steps: T[],
  fromIndex: number,
  direction: -1 | 1,
): T[] | null {
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= steps.length) {
    return null;
  }
  const next = [...steps];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((step, index) => ({
    ...step,
    sequenceOrder: index + 1,
  }));
}

/**
 * Insert a copy of the step at index immediately after it.
 * Returns null when the source index is missing.
 */
export function copyStepAt<T extends StepLike>(steps: T[], index: number): T[] | null {
  const source = steps[index];
  if (!source) {
    return null;
  }
  const next: T[] = [...steps];
  next.splice(index + 1, 0, {
    title: source.title,
    description: source.description,
    sequenceOrder: index + 2,
    imageUrl: source.imageUrl,
  } as T);
  return next.map((step, i) => ({
    ...step,
    sequenceOrder: i + 1,
  }));
}
