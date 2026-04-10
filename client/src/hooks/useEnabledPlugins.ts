import { useMemo } from 'react';

import { useApp } from '@/core/api/AppContext';

/**
 * Returns a stable Set of plugin names the current tenant has access to.
 * 'settings' is always included regardless of user.plugins.
 * Re-computed only when user.plugins changes.
 */
export function useEnabledPlugins(): Set<string> {
  const { user } = useApp();
  return useMemo(
    () => new Set([...(user?.plugins ?? []), 'settings']),

    [user?.plugins],
  );
}
