import { AlertTriangle, Loader2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import {
  GUIDE_LANGUAGE_SOURCE_BADGE_CLASS,
  isRetryableGenerationFailure,
  SUGGESTED_GUIDE_LANGUAGES,
  type GenerationFailureCode,
  type GuidePresentation,
  type ProductionStartMode,
  type ProductionStartScope,
} from '../types/guides';

interface StartProductionDialogProps {
  isOpen: boolean;
  mode: ProductionStartMode;
  scope: ProductionStartScope;
  isBusy?: boolean;
  hasActiveJob?: boolean;
  failureCode?: string | null;
  actionError?: string | null;
  presentations?: GuidePresentation[];
  sourceLanguage?: string;
  onConfirm: (options: { force: boolean; languages?: string[] }) => void;
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

function isSameLanguage(a: string, b: string): boolean {
  return a.toLowerCase().slice(0, 2) === b.toLowerCase().slice(0, 2);
}

export const StartProductionDialog: React.FC<StartProductionDialogProps> = ({
  isOpen,
  mode,
  isBusy = false,
  hasActiveJob = false,
  failureCode = null,
  actionError = null,
  presentations = [],
  sourceLanguage = '',
  onConfirm,
  onRetry,
  onCancel,
  onClearFailure,
}) => {
  const { t } = useTranslation();
  const [force, setForce] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(new Set());

  const sourceCode = sourceLanguage.toLowerCase();

  const translationOptions = useMemo(() => {
    const fromPresentations = presentations
      .filter((p) => !isSameLanguage(p.language, sourceCode))
      .map((p) => ({
        code: p.language.toLowerCase(),
        hasText: Boolean(p.presentationText?.trim()),
        exists: true,
      }));

    const existingCodes = new Set([
      sourceCode,
      ...fromPresentations.map((o) => o.code),
      ...presentations.map((p) => p.language.toLowerCase()),
    ]);

    const fromSuggested = SUGGESTED_GUIDE_LANGUAGES.filter((code) => !existingCodes.has(code)).map(
      (code) => ({
        code,
        hasText: false,
        exists: false,
      }),
    );

    return [...fromPresentations, ...fromSuggested].sort((a, b) => a.code.localeCompare(b.code));
  }, [presentations, sourceCode]);

  useEffect(() => {
    if (!isOpen) {
      setForce(false);
      return;
    }

    if (mode === 'source') {
      setSelectedLanguages(new Set(sourceCode ? [sourceCode] : []));
      return;
    }

    // Default: only existing target presentations that still lack text (not all suggested).
    const defaults = translationOptions.filter((o) => o.exists && !o.hasText).map((o) => o.code);
    setSelectedLanguages(new Set(defaults));
  }, [isOpen, mode, sourceCode, translationOptions]);

  const hasFailure = Boolean(failureCode);
  const retryable = isRetryableGenerationFailure(failureCode);
  const settingsLink = isSettingsFailure(failureCode);
  const codeKey = (failureCode || 'provider_unknown_error') as GenerationFailureCode;

  const titleKey =
    mode === 'source'
      ? 'guides.production.start.sourceTitle'
      : 'guides.production.start.translationsTitle';
  const descriptionKey =
    mode === 'source'
      ? 'guides.production.start.sourceDescription'
      : 'guides.production.start.translationsDescription';
  const confirmKey =
    mode === 'source'
      ? 'guides.production.start.sourceConfirm'
      : 'guides.production.start.translationsConfirm';

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
              <AlertDialogTitle>{t(titleKey)}</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 pt-1">
                <p>{t(descriptionKey)}</p>
                {mode === 'source' && (
                  <p className="text-xs text-muted-foreground">
                    {t('guides.production.start.sourcePhasesHint')}
                  </p>
                )}
                {mode === 'translation' && (
                  <p className="text-xs text-muted-foreground">
                    {t('guides.production.start.translationsPhasesHint')}
                  </p>
                )}
                {hasActiveJob && (
                  <p className="text-sm text-destructive">
                    {t('guides.production.activeJobConflict')}
                  </p>
                )}
              </AlertDialogDescription>
            </>
          )}
        </AlertDialogHeader>

        {!hasFailure && actionError && (
          <p className="text-sm text-destructive" role="alert">
            {actionError}
          </p>
        )}

        {!hasFailure && mode === 'source' && sourceCode && (
          <div className="py-1">
            <Label className="text-sm font-medium">
              {t('guides.production.start.sourceLanguageLabel')}
            </Label>
            <div className="mt-2">
              <Badge className={GUIDE_LANGUAGE_SOURCE_BADGE_CLASS}>{sourceCode}</Badge>
            </div>
          </div>
        )}

        {!hasFailure && mode === 'translation' && translationOptions.length > 0 && (
          <div className="space-y-2 py-1">
            <Label className="text-sm font-medium">
              {t('guides.production.start.languagesLabel')}
            </Label>
            <div className="flex flex-wrap gap-2">
              {translationOptions.map((opt) => {
                const checked = selectedLanguages.has(opt.code);
                return (
                  <label
                    key={opt.code}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      opt.hasText
                        ? checked
                          ? 'border-emerald-500/60 bg-emerald-50/90 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-emerald-500/40 bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : checked
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                    } ${isBusy ? 'pointer-events-none opacity-60' : ''}`}
                    title={opt.hasText ? t('guides.production.start.alreadyGenerated') : undefined}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      disabled={isBusy}
                      onChange={(e) => {
                        setSelectedLanguages((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(opt.code);
                          else next.delete(opt.code);
                          return next;
                        });
                      }}
                    />
                    <span className="uppercase font-semibold">{opt.code}</span>
                    {!opt.exists && <span className="text-[10px] text-muted-foreground">+</span>}
                    {opt.hasText && (
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400">✓</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {!hasFailure && (
          <div className="flex items-center gap-2 py-1">
            <input
              id="production-force"
              type="checkbox"
              checked={force}
              disabled={isBusy}
              onChange={(e) => setForce(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-border"
            />
            <Label htmlFor="production-force" className="text-sm font-normal leading-none">
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
              <AlertDialogAction
                disabled={
                  isBusy || hasActiveJob || (mode === 'translation' && selectedLanguages.size === 0)
                }
                aria-busy={isBusy}
                onClick={(event) => {
                  // Keep dialog open so 422 readiness failures (e.g. no AI provider) stay visible.
                  event.preventDefault();
                  onConfirm({
                    force,
                    languages: selectedLanguages.size ? Array.from(selectedLanguages) : undefined,
                  });
                }}
              >
                {isBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.checking')}
                  </>
                ) : (
                  t(confirmKey)
                )}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
