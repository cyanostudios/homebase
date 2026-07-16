import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import type { ProductionStartScope } from '../types/guides';

interface StartProductionDialogProps {
  isOpen: boolean;
  scope: ProductionStartScope;
  isBusy?: boolean;
  hasActiveJob?: boolean;
  onConfirm: (options: { force: boolean }) => void;
  onCancel: () => void;
}

function scopeTitleKey(scope: ProductionStartScope): string {
  if (scope.type === 'full_guide') return 'guides.production.start.fullGuideTitle';
  if (scope.type === 'stop') return 'guides.production.start.stopTitle';
  return 'guides.production.start.variantTitle';
}

function scopeDescriptionKey(scope: ProductionStartScope): string {
  if (scope.type === 'full_guide') return 'guides.production.start.fullGuideDescription';
  if (scope.type === 'stop') return 'guides.production.start.stopDescription';
  return 'guides.production.start.variantDescription';
}

export const StartProductionDialog: React.FC<StartProductionDialogProps> = ({
  isOpen,
  scope,
  isBusy = false,
  hasActiveJob = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [force, setForce] = useState(false);

  const scopeLabel =
    scope.type === 'stop'
      ? (scope.stopTitle ?? scope.stopId)
      : scope.type === 'variant'
        ? (scope.variantLabel ?? scope.variantId)
        : null;

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(scopeTitleKey(scope))}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 pt-1">
            <p>{t(scopeDescriptionKey(scope), { name: scopeLabel ?? '' })}</p>
            <p className="text-xs text-muted-foreground">
              {t('guides.production.start.phasesHint')}
            </p>
            {hasActiveJob && (
              <p className="text-sm text-destructive">{t('guides.production.activeJobConflict')}</p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-start gap-2 py-1">
          <input
            id="production-force"
            type="checkbox"
            checked={force}
            disabled={isBusy}
            onChange={(e) => setForce(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <Label htmlFor="production-force" className="text-sm font-normal leading-snug">
            {t('guides.production.start.forceLabel')}
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
              {t('common.cancel')}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="primary"
              disabled={isBusy || hasActiveJob}
              onClick={() => onConfirm({ force })}
            >
              {t('guides.production.start.confirm')}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
