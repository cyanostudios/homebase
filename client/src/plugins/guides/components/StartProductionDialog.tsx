import { AlertTriangle, Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

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

import {
  isRetryableGenerationFailure,
  type GenerationFailureCode,
  type ProductionStartScope,
} from '../types/guides';

interface StartProductionDialogProps {
  isOpen: boolean;
  scope: ProductionStartScope;
  isBusy?: boolean;
  hasActiveJob?: boolean;
  failureCode?: string | null;
  onConfirm: (options: { force: boolean }) => void;
  onRetry?: () => void;
  onCancel: () => void;
  onClearFailure?: () => void;
}

function isSettingsFailure(code: string | null | undefined): boolean {
  return (
    code === 'provider_not_configured' ||
    code === 'provider_not_generation_capable' ||
    code === 'provider_auth_failed'
  );
}

export const StartProductionDialog: React.FC<StartProductionDialogProps> = ({
  isOpen,
  isBusy = false,
  hasActiveJob = false,
  failureCode = null,
  onConfirm,
  onRetry,
  onCancel,
  onClearFailure,
}) => {
  const { t } = useTranslation();
  const [force, setForce] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setForce(false);
    }
  }, [isOpen]);

  const hasFailure = Boolean(failureCode);
  const retryable = isRetryableGenerationFailure(failureCode);
  const settingsLink = isSettingsFailure(failureCode);
  const codeKey = (failureCode || 'provider_unknown_error') as GenerationFailureCode;

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClearFailure?.();
          onCancel();
        }
      }}
    >
      <AlertDialogContent
        onEscapeKeyDown={(e) => {
          if (isBusy) e.preventDefault();
        }}
      >
        <AlertDialogHeader>
          {hasFailure ? (
            <>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {t(`guides.generation.failure.${codeKey}.title`, {
                  defaultValue: t('guides.generation.failure.provider_unknown_error.title'),
                })}
              </AlertDialogTitle>
              <AlertDialogDescription role="alert" className="pt-1">
                {t(`guides.generation.failure.${codeKey}.message`, {
                  defaultValue: t('guides.generation.failure.provider_unknown_error.message'),
                })}
              </AlertDialogDescription>
            </>
          ) : (
            <>
              <AlertDialogTitle>{t('guides.production.start.fullGuideTitle')}</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 pt-1">
                <p>{t('guides.production.start.fullGuideDescription')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('guides.production.start.phasesHint')}
                </p>
                {hasActiveJob && (
                  <p className="text-sm text-destructive">
                    {t('guides.production.activeJobConflict')}
                  </p>
                )}
              </AlertDialogDescription>
            </>
          )}
        </AlertDialogHeader>

        {!hasFailure && (
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
        )}

        <AlertDialogFooter>
          {hasFailure ? (
            <>
              <AlertDialogCancel asChild>
                <Button
                  variant="secondary"
                  onClick={() => {
                    onClearFailure?.();
                    onCancel();
                  }}
                >
                  {t('common.close')}
                </Button>
              </AlertDialogCancel>
              {settingsLink && (
                <Button variant="primary" asChild>
                  <Link to="/ai-providers">{t('guides.generation.openSettings')}</Link>
                </Button>
              )}
              {retryable && (
                <Button variant="primary" disabled={isBusy} onClick={() => onRetry?.()}>
                  {isBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('common.checking')}
                    </>
                  ) : (
                    t('guides.generation.retry')
                  )}
                </Button>
              )}
            </>
          ) : (
            <>
              <AlertDialogCancel asChild>
                <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
                  {t('common.cancel')}
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  variant="primary"
                  disabled={isBusy || hasActiveJob}
                  aria-busy={isBusy}
                  onClick={() => onConfirm({ force })}
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('common.checking')}
                    </>
                  ) : (
                    t('guides.production.start.confirm')
                  )}
                </Button>
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
