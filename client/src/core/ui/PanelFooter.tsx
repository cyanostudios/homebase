import { Check, X, Edit, Trash2, Copy } from 'lucide-react';
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

export const PanelFooter: React.FC<PanelFooterProps> = ({
  currentMode,
  currentItem: _currentItem,
  currentPluginContext: _currentPluginContext,
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
          {currentPlugin?.name !== 'contacts' && (
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
        className="h-7 text-[10px] px-2"
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

  return (
    <PanelFooter
      currentMode={currentMode}
      currentItem={currentItem}
      currentPluginContext={currentPluginContext}
      currentPlugin={handlers.currentPlugin}
      validationErrors={validationErrors}
      onDeleteItem={handlers.handleDeleteItem}
      onDuplicateItem={handlers.handleDuplicateItem}
      onClosePanel={handlers.getCloseHandler()}
      onEditItem={handleEditItem}
      onSaveClick={handleSave}
      onCancelClick={handleCancel}
    />
  );
};
