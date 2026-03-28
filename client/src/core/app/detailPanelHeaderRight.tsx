/**
 * Detail panel header actions (view: nav + update/edit + close; edit/create: close + save).
 * Extracted from App.tsx per guides/app-tsx-refactor-guide-for-cursor.md — behavior must stay identical.
 */
import { Check, Edit, X } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { ItemNavigation } from '@/core/ui/ItemNavigation';

export type PanelHeaderHandlers = {
  handleEditItem: () => void;
  handleCancelClick: () => void;
  handleSaveClick: () => void;
};

export type DetailPanelHeaderRightParams = {
  currentMode: string;
  currentPlugin: { name: string } | null | undefined;
  currentPluginContext: any;
  currentItem: any;
  validationErrors: any[];
  onDetailPanelClose: () => void;
  handlers: PanelHeaderHandlers;
  t: (key: string) => string;
};

export function renderDetailPanelHeaderRight({
  currentMode,
  currentPlugin,
  currentPluginContext,
  currentItem,
  validationErrors,
  onDetailPanelClose,
  handlers,
  t,
}: DetailPanelHeaderRightParams): React.ReactNode | undefined {
  const hasBlockingErrors = validationErrors.some(
    (e: any) => !String(e?.message || '').includes('Warning'),
  );
  const pluginName = currentPlugin?.name;
  const hasViewQuickUpdate =
    currentMode === 'view' &&
    ((Boolean(
      (pluginName === 'tasks' ||
        pluginName === 'estimates' ||
        pluginName === 'slots' ||
        pluginName === 'matches') &&
        typeof currentPluginContext?.hasQuickEditChanges === 'boolean' &&
        currentPluginContext.hasQuickEditChanges,
    ) ||
      Boolean(
        pluginName === 'contacts' &&
          typeof currentPluginContext?.hasTagsChanges === 'boolean' &&
          currentPluginContext.hasTagsChanges,
      )) as boolean);

  if (currentMode === 'view' && currentPluginContext && currentItem) {
    return (
      <div className="flex items-center gap-1">
        {typeof currentPluginContext.navigateToPrevItem === 'function' &&
          typeof currentPluginContext.navigateToNextItem === 'function' &&
          currentPluginContext.totalItems > 1 &&
          React.createElement(ItemNavigation, {
            onPrev: currentPluginContext.navigateToPrevItem,
            onNext: currentPluginContext.navigateToNextItem,
            hasPrev: currentPluginContext.hasPrevItem,
            hasNext: currentPluginContext.hasNextItem,
            label: `${currentPluginContext.currentItemIndex} / ${currentPluginContext.totalItems}`,
          })}
        {hasViewQuickUpdate ? (
          <Button
            type="button"
            onClick={() => {
              if (
                pluginName === 'tasks' ||
                pluginName === 'estimates' ||
                pluginName === 'slots' ||
                pluginName === 'matches'
              ) {
                currentPluginContext?.onApplyQuickEdit?.();
                return;
              }
              if (pluginName === 'contacts') {
                currentPluginContext?.onApplyTagsEdit?.();
              }
            }}
            variant="primary"
            size="sm"
            icon={Check}
            className="h-9 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-none"
          >
            {t('common.update')}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handlers.handleEditItem}
            variant="primary"
            size="sm"
            icon={Edit}
            className="h-9 text-xs px-3"
          >
            {t('common.edit')}
          </Button>
        )}
        <Button
          type="button"
          onClick={onDetailPanelClose}
          variant="secondary"
          size="sm"
          icon={X}
          className="h-9 text-xs px-3"
        >
          {t('common.close')}
        </Button>
      </div>
    );
  }

  if (currentMode === 'edit') {
    return (
      <div className="flex items-center gap-1">
        <Button
          type="button"
          onClick={handlers.handleCancelClick}
          variant="secondary"
          size="sm"
          icon={X}
          className="h-9 text-xs px-3"
        >
          {t('common.close')}
        </Button>
        <Button
          type="button"
          onClick={handlers.handleSaveClick}
          variant="primary"
          size="sm"
          icon={Check}
          disabled={hasBlockingErrors || Boolean(currentPluginContext?.isSaving)}
          className="h-9 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-none"
        >
          {currentPluginContext?.isSaving ? t('common.saving') : t('common.update')}
        </Button>
      </div>
    );
  }

  if (currentMode === 'create') {
    return (
      <div className="flex items-center gap-1">
        <Button
          type="button"
          onClick={handlers.handleCancelClick}
          variant="secondary"
          size="sm"
          icon={X}
          className="h-9 text-xs px-3"
        >
          {t('common.close')}
        </Button>
        <Button
          type="button"
          onClick={handlers.handleSaveClick}
          variant="primary"
          size="sm"
          icon={Check}
          disabled={hasBlockingErrors || Boolean(currentPluginContext?.isSaving)}
          className="h-9 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-none"
        >
          {currentPluginContext?.isSaving ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    );
  }

  return undefined;
}
