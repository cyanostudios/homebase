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
}

const EXPORT_FORMAT_LABELS: Record<string, string> = {
  txt: 'Export TXT',
  csv: 'Export CSV',
  pdf: 'Export PDF',
};

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
}) => {
  const hasBlockingErrors = validationErrors.some(
    (e: any) => !String(e?.message || '').includes('Warning'),
  );

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

  if (currentMode === 'view') {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={onDeleteItem}
            variant="ghost"
            size="sm"
            icon={Trash2}
            className="h-7 text-[10px] px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
          >
            Delete
          </Button>
          {Boolean(
            currentPluginContext?.getDuplicateConfig?.(currentItem) ||
              (currentItem && currentPlugin && currentPlugin.name !== 'contacts'),
          ) && (
            <Button
              type="button"
              onClick={onDuplicateItem}
              variant="ghost"
              size="sm"
              icon={Copy}
              className="h-7 text-[10px] px-2"
            >
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
                  size="sm"
                  icon={Icon}
                  className={action.className ?? 'h-7 text-[10px] px-2'}
                >
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
                size="sm"
                icon={Download}
                className="h-7 text-[10px] px-2"
              >
                {EXPORT_FORMAT_LABELS[format] ?? `Export ${format.toUpperCase()}`}
              </Button>
            ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={onClosePanel}
            variant="secondary"
            size="sm"
            icon={X}
            className="h-7 text-[10px] px-2"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={onEditItem}
            variant="primary"
            size="sm"
            icon={Edit}
            className="h-7 text-[10px] px-2"
          >
            Edit
          </Button>
          {currentPlugin?.name === 'tasks' &&
            typeof (currentPluginContext as any)?.hasQuickEditChanges === 'boolean' &&
            (currentPluginContext as any).hasQuickEditChanges && (
              <Button
                type="button"
                onClick={() => (currentPluginContext as any)?.onApplyQuickEdit?.()}
                variant="primary"
                size="sm"
                icon={Check}
                className="h-7 text-[10px] px-2 bg-green-600 hover:bg-green-700 text-white border-none"
              >
                Update
              </Button>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end space-x-2">
      <Button
        type="button"
        onClick={onCancelClick}
        variant="secondary"
        size="sm"
        icon={X}
        disabled={isSubmitting}
        className="h-7 text-[10px] px-2"
      >
        Cancel
      </Button>
      <Button
        type="button"
        onClick={onSaveClick}
        variant="primary"
        size="sm"
        icon={Check}
        disabled={hasBlockingErrors || isSubmitting}
        className="h-7 text-[10px] px-2 bg-green-600 hover:bg-green-700 text-white border-none"
      >
        {isSubmitting ? 'Saving...' : currentMode === 'edit' ? 'Update' : 'Save'}
      </Button>
    </div>
  );
};

// ---- Helpers ----
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Hyphen-safe opener resolver.
 * Examples:
 *  - 'contacts' + 'edit' -> context.openContactForEdit
 *  - 'notes' + 'view' -> context.openNoteForView
 */
function findOpenFunction(context: any, mode: 'edit' | 'view', pluginName?: string): any {
  if (!context || !pluginName) {
    return null;
  }

  // Generic: convert kebab to camel, singularize trailing 's'
  const camel = pluginName.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); // e.g., invoices -> Invoices
  const singular = camel.endsWith('s') ? camel.slice(0, -1) : camel; // contacts -> contact
  const fnName = `open${cap(singular)}For${cap(mode)}`; // openProductForEdit
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
    handleSaveClick: () => void; // generic (non-Woo) submit
    handleCancelClick: () => void; // generic (non-Woo) cancel
  },
) => {
  const pluginName = handlers.currentPlugin?.name;

  // Route EDIT to the correct opener (hyphen-safe + Woo override)
  const handleEditItem = () => {
    if (!currentPluginContext || !currentItem || !pluginName) {
      return;
    }
    const editFn = findOpenFunction(currentPluginContext, 'edit', pluginName);
    if (editFn) {
      editFn(currentItem);
    } else {
      console.warn(`Edit function not found for plugin: ${pluginName}`);
    }
  };

  const handleSave = () => {
    handlers.handleSaveClick();
  };

  const handleCancel = () => {
    handlers.handleCancelClick();
  };

  const baseClose = handlers.getCloseHandler();
  const onClosePanel =
    typeof currentPluginContext?.getCloseHandler === 'function' &&
    handlers.currentPlugin?.name === 'tasks'
      ? currentPluginContext.getCloseHandler(baseClose)
      : baseClose;

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
    />
  );
};
