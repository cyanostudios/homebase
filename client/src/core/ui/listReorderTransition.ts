import type { CSSProperties } from 'react';
import { flushSync } from 'react-dom';

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/**
 * Runs a list reorder state update inside the View Transition API when available,
 * so stable-keyed rows animate their position change. Falls back to a sync update.
 */
export function runListReorderTransition(update: () => void): void {
  if (typeof document === 'undefined') {
    update();
    return;
  }
  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition !== 'function') {
    update();
    return;
  }
  doc.startViewTransition(() => {
    flushSync(update);
  });
}

/** Safe unique `view-transition-name` for a line-item / reorderable row. */
export function listReorderViewTransitionName(stableId: string): string {
  const cleaned = String(stableId)
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
  return `list-reorder-${cleaned || 'row'}`;
}

export function listReorderRowStyle(stableId: string): CSSProperties {
  return {
    viewTransitionName: listReorderViewTransitionName(stableId),
  } as CSSProperties;
}
