import { Check, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

interface PanelFooterProps {
  currentMode: string;
  currentPluginContext: any;
  currentPlugin?: { name: string } | null;
  validationErrors: any[];
  onClosePanel: () => void;
  onSaveClick: () => void;
  onCancelClick: () => void;
  isSubmitting?: boolean;
}

export const PanelFooter: React.FC<PanelFooterProps> = ({
  currentMode,
  currentPlugin,
  validationErrors,
  onClosePanel,
  onSaveClick,
  onCancelClick,
  isSubmitting = false,
}) => {
  const { t } = useTranslation();
  const hasBlockingErrors = validationErrors.some(
    (e: any) => !String(e?.message || '').includes('Warning'),
  );

  // Settings plugin: Profile/Preferences = Cancel + Save; others = Close only
  if (currentPlugin?.name === 'settings') {
    return (
      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          onClick={onCancelClick}
          variant="secondary"
          size="sm"
          icon={X}
          disabled={isSubmitting}
          className="h-9 text-xs px-3"
        >
          {t('common.close')}
        </Button>
        <Button
          type="button"
          onClick={onSaveClick}
          variant="primary"
          size="sm"
          icon={Check}
          disabled={hasBlockingErrors || isSubmitting}
          className="h-9 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-none"
        >
          {isSubmitting ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    );
  }

  // Plugin-settings mode (e.g. Tasks settings): form manages its own Save; footer shows Close only
  if (currentMode === 'settings') {
    return (
      <div className="flex justify-end w-full">
        <Button
          type="button"
          onClick={onClosePanel}
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

  // View mode and create/edit modes: forms handle their own Save/Cancel inline
  return null;
};

export const createPanelFooter = (
  currentMode: 'create' | 'edit' | 'view' | 'settings',
  currentPluginContext: any,
  validationErrors: any[],
  handlers: {
    currentPlugin: { name: string } | null;
    getCloseHandler: () => () => void;
    handleSaveClick: () => void;
    handleCancelClick: () => void;
    isSubmitting?: boolean;
  },
) => {
  const baseClose = handlers.getCloseHandler();
  const onClosePanel =
    typeof currentPluginContext?.getCloseHandler === 'function' &&
    (handlers.currentPlugin?.name === 'tasks' ||
      handlers.currentPlugin?.name === 'contacts' ||
      handlers.currentPlugin?.name === 'estimates' ||
      handlers.currentPlugin?.name === 'slots' ||
      handlers.currentPlugin?.name === 'matches')
      ? currentPluginContext.getCloseHandler(baseClose)
      : baseClose;

  return (
    <PanelFooter
      currentMode={currentMode}
      currentPluginContext={currentPluginContext}
      currentPlugin={handlers.currentPlugin}
      validationErrors={validationErrors}
      onClosePanel={onClosePanel}
      onSaveClick={handlers.handleSaveClick}
      onCancelClick={handlers.handleCancelClick}
      isSubmitting={handlers.isSubmitting ?? false}
    />
  );
};
