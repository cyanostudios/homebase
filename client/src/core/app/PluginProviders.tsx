/**
 * Dynamic plugin providers – scales without App.tsx changes.
 * Tenant filtering: enabled plugins use their real Provider (loaded lazily via providerLoader);
 * disabled plugins use a lightweight NullProvider that supplies an empty but valid context so
 * the hook-call order in AppContent stays identical (React hooks rule compliance).
 */

import React, { useEffect, useMemo, useState } from 'react';

import { useApp } from '@/core/api/AppContext';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';

export function PluginProviders({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, closeOtherPanels } = useApp();
  const enabledNames = useEnabledPlugins();

  // Track dynamically loaded Provider components per plugin name
  const [loadedProviders, setLoadedProviders] = useState<Map<string, React.ComponentType<any>>>(
    () => new Map(),
  );

  // Pre-fetch heavy Provider chunks for all enabled plugins as soon as the user authenticates.
  // This moves Provider module loading off the critical (initial render) path.
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    PLUGIN_REGISTRY.forEach(({ name, providerLoader }) => {
      if (!providerLoader || !enabledNames.has(name)) {
        return;
      }
      providerLoader()
        .then((ProviderComponent) => {
          setLoadedProviders((prev) => {
            if (prev.get(name) === ProviderComponent) {
              return prev;
            }
            const next = new Map(prev);
            next.set(name, ProviderComponent);
            return next;
          });
        })
        .catch((err) => {
          console.error(`[PluginProviders] Failed to load provider for "${name}":`, err);
        });
    });
  }, [isAuthenticated, enabledNames]);

  // One stable handler per plugin name; recreated only when closeOtherPanels ref changes
  const closeHandlers = useMemo(
    () =>
      Object.fromEntries(
        PLUGIN_REGISTRY.map(({ name }) => [
          name,
          (exceptArg?: any) => {
            closeOtherPanels((typeof exceptArg !== 'undefined' ? exceptArg : name) as any);
          },
        ]),
      ),
    [closeOtherPanels],
  );

  return PLUGIN_REGISTRY.reduceRight((acc, plugin) => {
    const { name, NullProvider, Provider: FallbackProvider } = plugin;

    // Disabled plugins: use NullProvider (never load the heavy chunk)
    if (!enabledNames.has(name) && NullProvider !== undefined) {
      return <NullProvider key={name}>{acc}</NullProvider>;
    }

    // Enabled plugins: use dynamically loaded Provider if ready, otherwise FallbackProvider
    // (FallbackProvider is NullProvider for lazy-loaded plugins, or the real Provider for settings)
    const ActiveProvider = loadedProviders.get(name) ?? FallbackProvider;

    return (
      <ActiveProvider
        key={name}
        isAuthenticated={isAuthenticated}
        onCloseOtherPanels={closeHandlers[name]}
      >
        {acc}
      </ActiveProvider>
    );
  }, children);
}
