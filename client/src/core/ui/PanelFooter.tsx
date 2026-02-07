import { Check, X, Edit, Trash2 } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';

interface PanelFooterProps {
  currentMode: string;
  currentItem: any;
  currentPluginContext: any;
  validationErrors: any[];
  onDeleteItem: () => void;
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
  validationErrors,
  onDeleteItem,
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
        <Button
          type="button"
          onClick={onDeleteItem}
          variant="danger"
          size="sm"
          icon={Trash2}
          className="h-7 text-[10px] px-2"
        >
          Delete
        </Button>
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
      validationErrors={validationErrors}
      onDeleteItem={handlers.handleDeleteItem}
      onClosePanel={handlers.getCloseHandler()}
      onEditItem={handleEditItem}
      onSaveClick={handleSave}
      onCancelClick={handleCancel}
    />
  );
};
