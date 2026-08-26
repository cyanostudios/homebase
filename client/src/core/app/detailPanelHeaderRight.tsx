/**
 * Detail panel header actions (view: nav + update/edit + close; edit/create: close + save).
 * Extracted from App.tsx — behavior must stay identical. See docs/CORE_ARCHITECTURE_V2.md.
 */
import { Check, Edit, Eye, X } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { ItemNavigation } from '@/core/ui/ItemNavigation';

export type PanelHeaderHandlers = {
  handleEditItem: () => void;
  handleCancelClick: () => void;
  handleSaveClick: () => void;
  handlePreviewClick?: () => void;
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
  const showInvoicePreview =
    pluginName === 'invoices' && typeof handlers.handlePreviewClick === 'function';
  const hasViewQuickUpdate =
    currentMode === 'view' &&
    ((Boolean(
      (pluginName === 'tasks' ||
        pluginName === 'estimates' ||
        pluginName === 'slots' ||
        pluginName === 'matches' ||
        pluginName === 'cups') &&
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
      <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-1">
        {typeof currentPluginContext.navigateToPrevItem === 'function' &&
          typeof currentPluginContext.navigateToNextItem === 'function' &&
          currentPluginContext.totalItems > 1 &&
          React.createElement(ItemNavigation, {
            onPrev: currentPluginContext.navigateToPrevItem,
            onNext: currentPluginContext.navigateToNextItem,
            hasPrev: currentPluginContext.hasPrevItem,
            hasNext: currentPluginContext.hasNextItem,
            label: `${currentPluginContext.currentItemIndex} / ${currentPluginContext.totalItems}`,
            className: 'hidden md:inline-flex md:w-auto md:justify-center',
          })}
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-1">
          {hasViewQuickUpdate ? (
            <Button
              type="button"
              onClick={() => {
                if (
                  pluginName === 'tasks' ||
                  pluginName === 'estimates' ||
                  pluginName === 'slots' ||
                  pluginName === 'matches' ||
                  pluginName === 'cups'
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
              className="h-9 flex-1 px-3 text-xs border-none bg-green-600 text-white hover:bg-green-700 sm:flex-initial"
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
              className="h-9 flex-1 px-3 text-xs sm:flex-initial"
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
            className="h-9 flex-1 px-3 text-xs sm:flex-initial"
          >
            {t('common.close')}
          </Button>
        </div>
      </div>
    );
  }

  if (currentMode === 'edit') {
    return (
      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-1">
        {showInvoicePreview ? (
          <Button
            type="button"
            onClick={handlers.handlePreviewClick}
            variant="secondary"
            size="sm"
            icon={Eye}
            className="h-9 flex-1 px-3 text-xs sm:flex-initial"
          >
            {t('common.preview')}
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={handlers.handleCancelClick}
          variant="secondary"
          size="sm"
          icon={X}
          className="h-9 flex-1 px-3 text-xs sm:flex-initial"
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
          className="h-9 flex-1 border-none bg-green-600 px-3 text-xs text-white hover:bg-green-700 sm:flex-initial"
        >
          {currentPluginContext?.isSaving ? t('common.saving') : t('common.update')}
        </Button>
      </div>
    );
  }

  if (currentMode === 'create') {
    return (
      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-1">
        {showInvoicePreview ? (
          <Button
            type="button"
            onClick={handlers.handlePreviewClick}
            variant="secondary"
            size="sm"
            icon={Eye}
            className="h-9 flex-1 px-3 text-xs sm:flex-initial"
          >
            {t('common.preview')}
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={handlers.handleCancelClick}
          variant="secondary"
          size="sm"
          icon={X}
          className="h-9 flex-1 px-3 text-xs sm:flex-initial"
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
          className="h-9 flex-1 border-none bg-green-600 px-3 text-xs text-white hover:bg-green-700 sm:flex-initial"
        >
          {currentPluginContext?.isSaving ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    );
  }

  return undefined;
}
