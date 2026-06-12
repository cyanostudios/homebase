/**
 * Resolves the ContentHeader primary action (e.g. Add, Close on settings).
 * Logic extracted from App.tsx to keep orchestration thin; behavior must stay in sync with list/settings UX per plugin.
 */
import { Plus } from 'lucide-react';

import type { AppIcon } from '@/types/icons';

import type { PluginRegistryEntry } from '@/core/pluginRegistry';
import { getSingularCap } from '@/core/pluginSingular';

export type ResolvedPrimaryAction = null | {
  label: string;
  icon: AppIcon;
  onClick: () => void;
  variant?: 'secondary';
};

type ListOrSettings = 'list' | 'settings' | 'statistics' | undefined;

export function resolvePrimaryAction(
  currentPage: string,
  currentPagePlugin: PluginRegistryEntry | undefined,
  currentPluginContext: Record<string, unknown> | null | undefined,
  attemptNavigation: (fn: () => void) => void,
): ResolvedPrimaryAction {
  if (!currentPagePlugin || currentPagePlugin.name !== currentPage) {
    return null;
  }
  if (currentPagePlugin.noPrimaryAction) {
    return null;
  }

  const context = currentPluginContext;
  if (!context) {
    return null;
  }

  const contentViewKey = currentPagePlugin.contentViewKey;
  const currentContentView = contentViewKey
    ? (context[contentViewKey] as ListOrSettings)
    : undefined;
  const inAlternateView = currentContentView === 'settings' || currentContentView === 'statistics';
  if (inAlternateView) {
    return null;
  }

  const estimatesContentView = context.estimatesContentView as ListOrSettings;
  if (
    currentContentView === 'list' ||
    (currentPagePlugin.name === 'estimates' && estimatesContentView === 'list')
  ) {
    return null;
  }

  const capName = getSingularCap(currentPagePlugin.name);
  const fnName = `open${capName}Panel`;
  const openPanel = context[fnName];

  if (typeof openPanel !== 'function') {
    return null;
  }

  const singularLabel = getSingularCap(currentPagePlugin.name);
  return {
    label: `Add ${singularLabel}`,
    icon: Plus,
    onClick: () => attemptNavigation(() => (openPanel as (item: unknown) => void)(null)),
  };
}
