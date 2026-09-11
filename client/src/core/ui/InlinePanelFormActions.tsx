/**
 * Close / Save / Preview actions for create|edit — used by DetailPanel header and
 * mail-layout list detail columns (inline form).
 */
import { Check, Eye, X } from 'lucide-react';
import React from 'react';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';

export type InlinePanelFormActionsProps = {
  mode: 'create' | 'edit';
  isSaving?: boolean;
  hasBlockingErrors?: boolean;
  showPreview?: boolean;
  onPreview?: () => void;
  onClose: () => void;
  onSave: () => void;
  t: (key: string) => string;
  className?: string;
};

const actionButtonClass = 'min-w-0 flex-1 sm:flex-initial';

export function InlinePanelFormActions({
  mode,
  isSaving = false,
  hasBlockingErrors = false,
  showPreview = false,
  onPreview,
  onClose,
  onSave,
  t,
  className,
}: InlinePanelFormActionsProps) {
  return (
    <div className={className ?? 'flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-1'}>
      {showPreview && typeof onPreview === 'function' ? (
        <RoundIconLabelButton
          type="button"
          onClick={onPreview}
          icon={Eye}
          label={t('common.preview')}
          variant="secondary"
          alwaysExpanded
          className={actionButtonClass}
        />
      ) : null}
      <RoundIconLabelButton
        type="button"
        onClick={onClose}
        icon={X}
        label={t('common.close')}
        variant="secondary"
        alwaysExpanded
        className={actionButtonClass}
      />
      <RoundIconLabelButton
        type="button"
        onClick={onSave}
        icon={Check}
        label={
          isSaving ? t('common.saving') : mode === 'edit' ? t('common.update') : t('common.save')
        }
        variant="success"
        alwaysExpanded
        disabled={hasBlockingErrors || isSaving}
        className={actionButtonClass}
      />
    </div>
  );
}
