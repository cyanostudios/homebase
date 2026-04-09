import { useCallback } from 'react';

/**
 * Shared duplicate logic hook for plugin contexts.
 *
 * Provides stable `getDuplicateConfig` and `executeDuplicate` callbacks given
 * plugin-specific helpers.  Both params should be wrapped in `useCallback` /
 * stable references at the call site to avoid unnecessary re-renders.
 *
 * `getDefaultName` should return the **full** default name string (including any
 * "Copy of" prefix), giving each plugin full control over the naming format.
 *
 * Usage inside a plugin context:
 *
 *   const createDuplicate = useCallback(async (item, newName) => {
 *     const payload = { title: (newName ?? '').trim() || item.title };
 *     const created = await api.create(payload);
 *     setItems(prev => [created, ...prev]);
 *     return created;
 *   }, []);
 *
 *   const { getDuplicateConfig, executeDuplicate } = usePluginDuplicate({
 *     getDefaultName: (item) => `Copy of ${item.title?.trim() || 'Item'}`,
 *     nameLabel: t('plugin.title'),
 *     confirmOnly: false,
 *     createDuplicate,
 *     closePanel,
 *   });
 */
export function usePluginDuplicate<T extends { id: string | number | null | undefined }>({
  getDefaultName,
  nameLabel,
  confirmOnly = false,
  createDuplicate,
  closePanel,
}: {
  getDefaultName: (item: T) => string;
  nameLabel: string;
  confirmOnly?: boolean;
  createDuplicate: (item: T, newName: string) => Promise<T | null>;
  closePanel: () => void;
}) {
  const getDuplicateConfig = useCallback(
    (item: T | null) => {
      if (!item) {
        return null;
      }
      return {
        defaultName: getDefaultName(item),
        nameLabel,
        confirmOnly,
      };
    },
    [getDefaultName, nameLabel, confirmOnly],
  );

  const executeDuplicate = useCallback(
    async (item: T, newName: string): Promise<{ closePanel: () => void; highlightId?: string }> => {
      const newItem = await createDuplicate(item, newName);
      const id = newItem?.id;
      const highlightId = id !== undefined && id !== null ? String(id) : undefined;
      return { closePanel, highlightId };
    },
    [createDuplicate, closePanel],
  );

  return { getDuplicateConfig, executeDuplicate };
}
