/**
 * Resolves the ContentHeader primary action (e.g. Add, Close on settings).
 * Logic extracted from App.tsx to keep orchestration thin; behavior must stay in sync with list/settings UX per plugin.
 */
import { Plus, X, type LucideIcon } from 'lucide-react';

import type { PluginRegistryEntry } from '@/core/pluginRegistry';
import { getSingularCap } from '@/core/pluginSingular';

export type ResolvedPrimaryAction = null | {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'secondary';
};

type ListOrSettings = 'list' | 'settings' | undefined;

type PluginContextRow = {
  plugin: Pick<PluginRegistryEntry, 'name'>;
  context: Record<string, unknown> | null | undefined;
};

export function resolvePrimaryAction(
  currentPage: string,
  currentPagePlugin: PluginRegistryEntry | undefined,
  pluginContexts: PluginContextRow[],
  attemptNavigation: (fn: () => void) => void,
  t: (key: string) => string,
): ResolvedPrimaryAction {
  if (!currentPagePlugin || currentPagePlugin.name !== currentPage) {
    return null;
  }
  if (
    currentPagePlugin.name === 'slots' ||
    currentPagePlugin.name === 'notes' ||
    currentPagePlugin.name === 'ingest'
  ) {
    return null;
  }

  const context = pluginContexts.find(({ plugin }) => plugin.name === currentPagePlugin.name)
    ?.context as Record<string, unknown> | null | undefined;
  if (!context) {
    return null;
  }

  const inSettings =
    (currentPagePlugin.name === 'contacts' &&
      (context.contactsContentView as ListOrSettings) === 'settings') ||
    (currentPagePlugin.name === 'tasks' &&
      (context.tasksContentView as ListOrSettings) === 'settings') ||
    (currentPagePlugin.name === 'matches' &&
      (context.matchesContentView as ListOrSettings) === 'settings') ||
    (currentPagePlugin.name === 'mail' &&
      (context.mailContentView as ListOrSettings) === 'settings') ||
    (currentPagePlugin.name === 'pulses' &&
      (context.pulsesContentView as ListOrSettings) === 'settings');
  if (inSettings) {
    return null;
  }

  const estimatesContentView = context.estimatesContentView as ListOrSettings;
  const closeEstimateSettingsView = context.closeEstimateSettingsView as (() => void) | undefined;
  if (
    currentPagePlugin.name === 'estimates' &&
    estimatesContentView === 'settings' &&
    typeof closeEstimateSettingsView === 'function'
  ) {
    return {
      label: t('common.close'),
      icon: X,
      onClick: closeEstimateSettingsView,
      variant: 'secondary',
    };
  }

  const filesContentView = context.filesContentView as ListOrSettings;
  const closeFileSettingsView = context.closeFileSettingsView as (() => void) | undefined;
  if (
    currentPagePlugin.name === 'files' &&
    filesContentView === 'settings' &&
    typeof closeFileSettingsView === 'function'
  ) {
    return {
      label: t('common.close'),
      icon: X,
      onClick: closeFileSettingsView,
      variant: 'secondary',
    };
  }

  if (
    (currentPagePlugin.name === 'contacts' &&
      (context.contactsContentView as string | undefined) === 'list') ||
    (currentPagePlugin.name === 'tasks' &&
      (context.tasksContentView as string | undefined) === 'list') ||
    (currentPagePlugin.name === 'matches' &&
      (context.matchesContentView as string | undefined) === 'list') ||
    (currentPagePlugin.name === 'mail' &&
      (context.mailContentView as string | undefined) === 'list') ||
    (currentPagePlugin.name === 'pulses' &&
      (context.pulsesContentView as string | undefined) === 'list')
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
