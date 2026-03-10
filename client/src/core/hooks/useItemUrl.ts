import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildSlug } from '@/core/utils/slugUtils';

/**
 * Provides URL-sync helpers for a plugin's item panel.
 *
 * Usage inside a plugin context (Provider component):
 *
 *   const { navigateToItem, navigateToBase } = useItemUrl('/notes');
 *
 *   openNoteForView: (note) => {
 *     // … set state …
 *     navigateToItem(note, notes, 'title');   // → /notes/min-anteckning
 *   }
 *
 *   closeNotePanel: () => {
 *     // … clear state …
 *     navigateToBase();          // → /notes (only if currently on /notes/…)
 *   }
 *
 * The helpers are safe to call from any context:
 * - `navigateToItem` only navigates if the current URL is already on the plugin's base path.
 * - `navigateToBase` only navigates if the URL currently has an item segment.
 * Both checks prevent URL pollution during cross-plugin panel interactions.
 */
export function useItemUrl(basePath: string) {
  const navigate = useNavigate();

  /**
   * Navigate to /basePath/<slug> — only when currently on basePath.
   *
   * @param item      The item being opened.
   * @param allItems  All items in the list (for collision detection).
   * @param nameField Field name (or getter fn) that provides the human-readable label.
   */
  const navigateToItem = useCallback(
    (
      item: Record<string, any>,
      allItems: Record<string, any>[],
      nameField: string | ((i: Record<string, any>) => string),
    ) => {
      if (window.location.pathname.startsWith(basePath)) {
        const slug = buildSlug(item, allItems, nameField);
        navigate(`${basePath}/${slug}`);
      }
    },
    [navigate, basePath],
  );

  /** Navigate to basePath (strip item segment) — only when URL has one. */
  const navigateToBase = useCallback(() => {
    if (window.location.pathname.startsWith(basePath)) {
      navigate(basePath);
    }
  }, [navigate, basePath]);

  /** True if the browser is currently on this plugin's page (any sub-path). */
  const isOnPluginPage = useCallback(
    () => window.location.pathname.startsWith(basePath),
    [basePath],
  );

  return { navigateToItem, navigateToBase, isOnPluginPage };
}
