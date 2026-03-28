import { Check, X, Edit, Trash2, Copy, Download } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';

interface PanelFooterProps {
  currentMode: string;
  currentItem: any;
  currentPluginContext: any;
  currentPlugin?: { name: string } | null;
  validationErrors: any[];
  onDeleteItem: () => void;
  onDuplicateItem: () => void;
  onClosePanel: () => void;
  onEditItem: () => void;
  onSaveClick: () => void;
  onCancelClick: () => void;
  isSubmitting?: boolean;
  showEditButton?: boolean;
}

const EXPORT_FORMAT_LABELS: Record<string, string> = {
  txt: 'Export TXT',
  csv: 'Export CSV',
  pdf: 'Export PDF',
};

const BTN_XS = 'sm' as const;

export const PanelFooter: React.FC<PanelFooterProps> = ({
  currentMode,
  currentItem,
  currentPluginContext,
  currentPlugin,
  validationErrors,
  onDeleteItem,
  onDuplicateItem,
  onClosePanel,
  onEditItem,
  onSaveClick,
  onCancelClick,
  isSubmitting = false,
  showEditButton = true,
}) => {
  const isWarningMessage = (msg: string) => /warning/i.test(msg) || /varning/i.test(msg);
  const hasBlockingErrors = validationErrors.some(
    (e: any) => !isWarningMessage(String(e?.message || '')),
  );
  const hasPriceWarning =
    currentPlugin?.name === 'products' &&
    validationErrors.some(
      (e: any) => e?.field === 'priceAmount' && /effektivt pris/i.test(String(e?.message || '')),
    );
  const priceWarningMessage = hasPriceWarning
    ? validationErrors.find(
        (e: any) => e?.field === 'priceAmount' && /effektivt pris/i.test(String(e?.message || '')),
      )?.message
    : null;

  const exportFormats = currentPluginContext?.exportFormats as string[] | undefined;
  const onExportItem = currentPluginContext?.onExportItem as
    | ((format: string, item: any) => void)
    | undefined;
  const hasExport = Boolean(
    currentItem &&
      Array.isArray(exportFormats) &&
      exportFormats.length > 0 &&
      typeof onExportItem === 'function',
  );

  const detailFooterActions = currentPluginContext?.detailFooterActions as
    | Array<{
        id: string;
        label: string;
        icon: React.ComponentType<{ className?: string }>;
        onClick: (item: any) => void;
        className?: string;
      }>
    | undefined;
  const hasDetailFooterActions = Boolean(
    currentItem && Array.isArray(detailFooterActions) && detailFooterActions.length > 0,
  );

  const showDuplicate =
    currentPluginContext?.getDuplicateConfig?.(currentItem) ||
    (currentItem && currentPlugin && currentPlugin.name !== 'contacts');

  // Channels (CDON/Fyndiq detail): show Cancel/Update instead of Close/Edit
  if (currentMode === 'view' && currentPlugin?.name === 'channels') {
    return (
      <div className="flex justify-end w-full">
        <Button type="button" onClick={onClosePanel} variant="secondary" size={BTN_XS}>
          <X className="h-4 w-4" />
          Close
        </Button>
        <Button
          type="button"
          onClick={onSaveClick}
          variant="primary"
          size={BTN_XS}
          disabled={isSubmitting}
          className="bg-green-600 hover:bg-green-700 text-white border-none"
        >
          <Check className="h-4 w-4" />
          Update
        </Button>
      </div>
    );
  }

  if (currentMode === 'view') {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={onDeleteItem}
            variant="ghost"
            size={BTN_XS}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          {showDuplicate && (
            <Button type="button" onClick={onDuplicateItem} variant="ghost" size={BTN_XS}>
              <Copy className="h-4 w-4" />
              Duplicate
            </Button>
          )}
          {hasDetailFooterActions &&
            detailFooterActions!.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  type="button"
                  onClick={() => action.onClick(currentItem)}
                  variant="ghost"
                  size={BTN_XS}
                  className={action.className}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {action.label}
                </Button>
              );
            })}
          {hasExport &&
            exportFormats!.map((format: string) => (
              <Button
                key={format}
                type="button"
                onClick={() => onExportItem!(format, currentItem)}
                variant="ghost"
                size={BTN_XS}
              >
                <Download className="h-4 w-4" />
                {EXPORT_FORMAT_LABELS[format] ?? `Export ${format.toUpperCase()}`}
              </Button>
            ))}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={onClosePanel} variant="secondary" size={BTN_XS}>
            <X className="h-4 w-4" />
            Close
          </Button>
          {showEditButton && (
            <Button type="button" onClick={onEditItem} variant="primary" size={BTN_XS}>
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          )}
          {currentPlugin?.name === 'tasks' &&
            typeof (currentPluginContext as any)?.hasQuickEditChanges === 'boolean' &&
            (currentPluginContext as any).hasQuickEditChanges && (
              <Button
                type="button"
                onClick={() => (currentPluginContext as any)?.onApplyQuickEdit?.()}
                variant="primary"
                size={BTN_XS}
                className="bg-green-600 hover:bg-green-700 text-white border-none"
              >
                <Check className="h-4 w-4" />
                Update
              </Button>
            )}
          {currentPlugin?.name === 'contacts' &&
            typeof (currentPluginContext as any)?.hasTagsChanges === 'boolean' &&
            (currentPluginContext as any).hasTagsChanges && (
              <Button
                type="button"
                onClick={() => (currentPluginContext as any)?.onApplyTagsEdit?.()}
                variant="primary"
                size={BTN_XS}
                className="bg-green-600 hover:bg-green-700 text-white border-none"
              >
                <Check className="h-4 w-4" />
                Update
              </Button>
            )}
        </div>
      </div>
    );
  }

  const onIgnorePriceWarning =
    hasPriceWarning && typeof (window as any).submitProductsFormIgnorePriceWarning === 'function'
      ? () => (window as any).submitProductsFormIgnorePriceWarning()
      : undefined;

  const saveBlocked = hasBlockingErrors || isSubmitting;
  const showIgnoreButton = hasPriceWarning && onIgnorePriceWarning;

  const otherBlockingErrors = validationErrors.filter((e: any) => {
    const msg = String(e?.message || '');
    if (isWarningMessage(msg)) {
      return false;
    }
    if (e?.field === 'priceAmount' && /effektivt pris/i.test(msg)) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-2 w-full">
      {hasPriceWarning && priceWarningMessage && (
        <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm">
          {priceWarningMessage}
        </div>
      )}
      {otherBlockingErrors.length > 0 && (
        <div
          role="alert"
          className="text-red-900 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm space-y-2"
        >
          <p className="font-medium">Sparningen misslyckades</p>
          <ul className="list-disc list-inside space-y-1">
            {otherBlockingErrors.map((e: any) => (
              <li key={`${String(e?.field ?? 'err')}:${String(e?.message ?? '')}`}>
                {String(e?.message || '')}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          onClick={onCancelClick}
          variant="secondary"
          size={BTN_XS}
          disabled={isSubmitting}
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
        {showIgnoreButton ? (
          <Button
            type="button"
            onClick={onIgnorePriceWarning}
            variant="primary"
            size={BTN_XS}
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white border-none"
          >
            <Check className="h-4 w-4" />
            {isSubmitting ? 'Saving...' : 'Ignore and update anyway'}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onSaveClick}
            variant="primary"
            size={BTN_XS}
            disabled={saveBlocked}
            className="bg-green-600 hover:bg-green-700 text-white border-none"
          >
            <Check className="h-4 w-4" />
            {isSubmitting ? 'Saving...' : currentMode === 'edit' ? 'Update' : 'Save'}
          </Button>
        )}
      </div>
    </div>
  );
};

// ---- Helpers ----
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function findOpenFunction(context: any, mode: 'edit' | 'view', pluginName?: string): any {
  if (!context || !pluginName) {
    return null;
  }
  const camel = pluginName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const singular = camel.endsWith('s') ? camel.slice(0, -1) : camel;
  const fnName = `open${cap(singular)}For${cap(mode)}`;
  const fn = context[fnName];
  return typeof fn === 'function' ? fn : null;
}

export const createPanelFooter = (
  currentMode: 'create' | 'edit' | 'view' | 'settings',
  currentItem: any,
  currentPluginContext: any,
  validationErrors: any[],
  handlers: {
    currentPlugin: { name: string } | null;
    handleDeleteItem: () => void;
    handleDuplicateItem: () => void;
    getCloseHandler: () => () => void;
    handleSaveClick: () => void;
    handleCancelClick: () => void;
    isSubmitting?: boolean;
  },
) => {
  const handleSave = () => handlers.handleSaveClick();
  const handleCancel = () => handlers.handleCancelClick();

  const baseClose = handlers.getCloseHandler();
  const onClosePanel =
    typeof currentPluginContext?.getCloseHandler === 'function' &&
    (handlers.currentPlugin?.name === 'tasks' || handlers.currentPlugin?.name === 'contacts')
      ? currentPluginContext.getCloseHandler(baseClose)
      : baseClose;

  // Channels: Cancel and Update both close the panel
  const pluginName = handlers.currentPlugin?.name;
  if (pluginName === 'channels') {
    return (
      <PanelFooter
        currentMode={currentMode}
        currentItem={currentItem}
        currentPluginContext={currentPluginContext}
        currentPlugin={handlers.currentPlugin}
        validationErrors={validationErrors}
        onDeleteItem={() => {}}
        onDuplicateItem={() => {}}
        onClosePanel={baseClose}
        onEditItem={() => {}}
        onSaveClick={baseClose}
        onCancelClick={baseClose}
        isSubmitting={handlers.isSubmitting ?? false}
      />
    );
  }

  const handleEditItem = () => {
    if (!currentPluginContext || !currentItem || !pluginName) {
      return;
    }
    const editFn = findOpenFunction(currentPluginContext, 'edit', pluginName);
    if (editFn) {
      editFn(currentItem);
    }
  };

  const showEditButton = !!(
    pluginName && findOpenFunction(currentPluginContext, 'edit', pluginName)
  );

  return (
    <PanelFooter
      currentMode={currentMode}
      currentItem={currentItem}
      currentPluginContext={currentPluginContext}
      currentPlugin={handlers.currentPlugin}
      validationErrors={validationErrors}
      onDeleteItem={handlers.handleDeleteItem}
      onDuplicateItem={handlers.handleDuplicateItem}
      onClosePanel={onClosePanel}
      onEditItem={handleEditItem}
      onSaveClick={handleSave}
      onCancelClick={handleCancel}
      isSubmitting={handlers.isSubmitting ?? false}
      showEditButton={showEditButton}
    />
  );
};
