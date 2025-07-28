import React from 'react';
import { Button } from '@/core/ui/Button';
import { Check, X, Edit, Trash2 } from 'lucide-react';

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
  onCancelClick
}) => {
  // Check if there are any blocking errors (non-warning)
  const hasBlockingErrors = validationErrors.some((error: any) => !error.message.includes('Warning'));

  if (currentMode === 'view') {
    return (
      <div className="flex items-center justify-between w-full">
        <Button
          type="button"
          onClick={onDeleteItem}
          variant="danger"
          icon={Trash2}
        >
          Delete
        </Button>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={onClosePanel}
            variant="secondary"
            icon={X}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={onEditItem}
            variant="primary"
            icon={Edit}
          >
            Edit
          </Button>
        </div>
      </div>
    );
  }

  // Form mode (create/edit)
  return (
    <div className="flex justify-end space-x-3">
      <Button
        type="button"
        onClick={onCancelClick}
        variant="danger"
        icon={X}
      >
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

export const createPanelFooter = (
  currentMode: string,
  currentItem: any,
  currentPluginContext: any,
  validationErrors: any[],
  handlers: any
) => {
  const handleEditItem = () => {
    if (currentPluginContext && currentItem) {
      const editFunction = currentPluginContext.openContactForEdit || 
                         currentPluginContext.openNoteForEdit || 
                         currentPluginContext.openEstimateForEdit;
      if (editFunction) editFunction(currentItem);
    }
  };

  return (
    <PanelFooter
      currentMode={currentMode}
      currentItem={currentItem}
      currentPluginContext={currentPluginContext}
      validationErrors={validationErrors}
      onDeleteItem={() => handlers.handleDeleteItem()}
      onClosePanel={handlers.handleClosePanel}
      onEditItem={handleEditItem}
      onSaveClick={handlers.handleSaveClick}
      onCancelClick={handlers.handleCancelClick}
    />
  );
};