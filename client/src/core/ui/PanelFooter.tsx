import { Check, X, Edit, Trash2 } from 'lucide-react';
import React from 'react';

import { Button } from '@/core/ui/Button';

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
}

export const PanelFooter: React.FC<PanelFooterProps> = ({
  currentMode,
  currentItem,
  currentPluginContext,
  validationErrors,
  onDeleteItem,
  onClosePanel,
  onEditItem,
  onSaveClick,
  onCancelClick,
}) => {
  const hasBlockingErrors = validationErrors.some(
    (e: any) => !String(e?.message || '').includes('Warning'),
  );

  if (currentMode === 'view') {
    return (
      <div className="flex items-center justify-between w-full">
        <Button type="button" onClick={onDeleteItem} variant="danger" icon={Trash2}>
          Delete
        </Button>
        <div className="flex items-center gap-3">
          <Button type="button" onClick={onClosePanel} variant="secondary" icon={X}>
            Close
          </Button>
          <Button type="button" onClick={onEditItem} variant="primary" icon={Edit}>
            Edit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end space-x-3">
      <Button type="button" onClick={onCancelClick} variant="danger" icon={X}>
        Cancel
      </Button>
      <Button
        type="button"
        onClick={onSaveClick}
        variant="primary"
        icon={Check}
        disabled={hasBlockingErrors}
      >
        {currentMode === 'edit' ? 'Update' : 'Save'}
      </Button>
    </div>
  );
};

// ---- Helpers ----
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Hyphen-safe opener resolver.
 * Examples:
 *  - 'products' + 'edit' -> context.openProductForEdit
 *  - 'notes' + 'view' -> context.openNoteForView
 *  - 'woocommerce-products' + 'edit' -> context.openWooSettingsForEdit (special case)
 */
function findOpenFunction(context: any, mode: 'edit' | 'view', pluginName?: string): any {
  if (!context || !pluginName) {
    return null;
  }

  // Special-case Woo settings (naming deviates by design)
  if (pluginName === 'woocommerce-products') {
    const fn = context[`openWooSettingsFor${cap(mode)}`];
    return typeof fn === 'function' ? fn : null;
  }

  // Generic: convert kebab to camel, singularize trailing 's'
  const camel = pluginName.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); // e.g., woocommerceProducts
  const singular = camel.endsWith('s') ? camel.slice(0, -1) : camel; // products -> product
  const fnName = `open${cap(singular)}For${cap(mode)}`; // openProductForEdit
  const fn = context[fnName];
  return typeof fn === 'function' ? fn : null;
}

export const createPanelFooter = (
  currentMode: 'create' | 'edit' | 'view',
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

  // Wire Save/Cancel to Woo settings events when inside woocommerce-products
  const handleSave = () => {
    if (pluginName === 'woocommerce-products' && (window as any).submitWooSettingsForm) {
      (window as any).submitWooSettingsForm();
    } else {
      handlers.handleSaveClick();
    }
  };

  const handleCancel = () => {
    if (pluginName === 'woocommerce-products' && (window as any).cancelWooSettingsForm) {
      (window as any).cancelWooSettingsForm();
    } else {
      handlers.handleCancelClick();
    }
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
