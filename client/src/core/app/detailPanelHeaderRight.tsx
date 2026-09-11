/**
 * Detail panel header actions (view: nav + update/edit + close; edit/create: close + save).
 * Extracted from App.tsx — behavior must stay identical. See docs/CORE_ARCHITECTURE_V2.md.
 */
import { Check, Edit, X } from 'lucide-react';
import React from 'react';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { InlinePanelFormActions } from '@/core/ui/InlinePanelFormActions';
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

  const actionButtonClass = 'min-w-0 flex-1 sm:flex-initial';

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
            <RoundIconLabelButton
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
              icon={Check}
              label={t('common.update')}
              variant="success"
              alwaysExpanded
              className={actionButtonClass}
            />
          ) : (
            <RoundIconLabelButton
              type="button"
              onClick={handlers.handleEditItem}
              icon={Edit}
              label={t('common.edit')}
              variant="soft"
              alwaysExpanded
              className={actionButtonClass}
            />
          )}
          <RoundIconLabelButton
            type="button"
            onClick={onDetailPanelClose}
            icon={X}
            label={t('common.close')}
            variant="secondary"
            alwaysExpanded
            className={actionButtonClass}
          />
        </div>
      </div>
    );
  }

  if (currentMode === 'edit' || currentMode === 'create') {
    return (
      <InlinePanelFormActions
        mode={currentMode}
        isSaving={Boolean(currentPluginContext?.isSaving)}
        hasBlockingErrors={hasBlockingErrors}
        showPreview={showInvoicePreview}
        onPreview={handlers.handlePreviewClick}
        onClose={handlers.handleCancelClick}
        onSave={handlers.handleSaveClick}
        t={t}
      />
    );
  }

  return undefined;
}
