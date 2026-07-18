import { Check, Edit, Languages, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { guidesApi } from '../api/guidesApi';
import {
  isPresentationApprovalStatus,
  isPublicationStatus,
  isStalenessStatus,
  PUBLICATION_STATUSES,
  type GuidePresentation,
  type GuidePresentationUpdatePayload,
  type GuideValidationError,
} from '../types/guides';

interface GuidePresentationSectionProps {
  placeId: string;
  sourceLanguage: string;
  disabled?: boolean;
  /** Bump to reload presentations (e.g. after production approve). */
  refreshKey?: string;
}

export const GuidePresentationSection: React.FC<GuidePresentationSectionProps> = ({
  placeId,
  sourceLanguage,
  disabled = false,
  refreshKey = '',
}) => {
  const { t } = useTranslation();
  const [presentations, setPresentations] = useState<GuidePresentation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GuidePresentationUpdatePayload>({
    presentationText: null,
    publicationStatus: 'draft',
  });
  const [validationErrors, setValidationErrors] = useState<GuideValidationError[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const loadPresentations = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoading(true);
      }
      setGeneralError(null);
      try {
        const data = await guidesApi.getPresentations(placeId);
        setPresentations(data);
      } catch {
        setGeneralError(t('guides.presentationsLoadFailed'));
        setPresentations([]);
      } finally {
        setIsLoading(false);
      }
    },
    [placeId, t],
  );

  useEffect(() => {
    void loadPresentations();
  }, [loadPresentations]);

  useEffect(() => {
    if (!refreshKey) return;
    void loadPresentations({ silent: true });
  }, [loadPresentations, refreshKey]);

  const sourcePresentation = useMemo(
    () =>
      presentations.find((p) => p.language.toLowerCase() === sourceLanguage.toLowerCase()) ??
      presentations[0] ??
      null,
    [presentations, sourceLanguage],
  );

  const otherPresentations = useMemo(
    () => presentations.filter((p) => !sourcePresentation || p.id !== sourcePresentation.id),
    [presentations, sourcePresentation],
  );

  const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);

  const openEdit = (presentation: GuidePresentation) => {
    setEditingId(presentation.id);
    setForm({
      presentationText: presentation.presentationText,
      publicationStatus: isPublicationStatus(presentation.publicationStatus)
        ? presentation.publicationStatus
        : 'draft',
    });
    setValidationErrors([]);
    setGeneralError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setValidationErrors([]);
    setGeneralError(null);
  };

  const handleSave = async (presentation: GuidePresentation) => {
    setIsBusy(true);
    setValidationErrors([]);
    setGeneralError(null);
    try {
      const payload: GuidePresentationUpdatePayload = {
        presentationText: form.presentationText?.trim() ? form.presentationText : null,
        publicationStatus: form.publicationStatus,
      };
      const updated = await guidesApi.updatePresentation(placeId, presentation.language, payload);
      setPresentations((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingId(null);
    } catch (err) {
      const error = err as { errors?: GuideValidationError[] };
      if (Array.isArray(error.errors)) {
        setValidationErrors(error.errors);
      } else {
        setGeneralError(t('guides.presentationsSaveFailed'));
      }
    } finally {
      setIsBusy(false);
    }
  };

  const renderStatusBadges = (presentation: GuidePresentation) => {
    const publication = isPublicationStatus(presentation.publicationStatus)
      ? presentation.publicationStatus
      : 'draft';
    const staleness = isStalenessStatus(presentation.stalenessStatus)
      ? presentation.stalenessStatus
      : 'fresh';
    const approval = isPresentationApprovalStatus(presentation.approvalStatus)
      ? presentation.approvalStatus
      : 'draft';

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="uppercase">
          {presentation.language}
        </Badge>
        <Badge variant="secondary">{t(`guides.publication.${publication}`)}</Badge>
        <Badge variant="outline">{t(`guides.staleness.${staleness}`)}</Badge>
        <Badge variant="outline">{t(`guides.approval.${approval}`)}</Badge>
      </div>
    );
  };

  const renderEditor = (presentation: GuidePresentation) => {
    const textError = getFieldError('presentationText');
    const pubError = getFieldError('publicationStatus');

    return (
      <div className="space-y-3 rounded-md border border-border/70 bg-muted/10 p-4">
        <div className="space-y-2">
          <Label htmlFor={`presentation-text-${presentation.id}`}>
            {t('guides.presentationText')}
          </Label>
          <Textarea
            id={`presentation-text-${presentation.id}`}
            rows={8}
            value={form.presentationText ?? ''}
            disabled={isBusy || disabled}
            placeholder={t('guides.presentationTextPlaceholder')}
            onChange={(e) => setForm((prev) => ({ ...prev, presentationText: e.target.value }))}
            className={cn(textError && 'border-destructive')}
          />
          {textError && <p className="text-xs text-destructive">{textError.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`presentation-pub-${presentation.id}`}>
            {t('guides.publicationStatus')}
          </Label>
          <NativeSelect
            id={`presentation-pub-${presentation.id}`}
            value={form.publicationStatus ?? 'draft'}
            disabled={isBusy || disabled}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                publicationStatus: e.target
                  .value as GuidePresentationUpdatePayload['publicationStatus'],
              }))
            }
            className={cn(pubError && 'border-destructive')}
          >
            {PUBLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`guides.publication.${status}`)}
              </option>
            ))}
          </NativeSelect>
          {pubError && <p className="text-xs text-destructive">{pubError.message}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={Check}
            className="h-8 px-3 text-xs"
            disabled={isBusy || disabled}
            onClick={() => void handleSave(presentation)}
          >
            {t('common.save')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={X}
            className="h-8 px-3 text-xs"
            disabled={isBusy}
            onClick={cancelEdit}
          >
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    );
  };

  const renderPresentationCard = (
    presentation: GuidePresentation,
    options?: { emphasize?: boolean; emptyHint?: string },
  ) => {
    const isEditing = editingId === presentation.id;
    const text = presentation.presentationText?.trim();

    return (
      <li
        key={presentation.id}
        className={cn(
          'rounded-lg border border-border/70 bg-card p-4',
          options?.emphasize && 'border-primary/20',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            {renderStatusBadges(presentation)}
            {!isEditing && (
              <p className="whitespace-pre-wrap text-sm">
                {text || options?.emptyHint || t('guides.presentationTextEmpty')}
              </p>
            )}
          </div>
          {!isEditing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={Edit}
              className="h-8 px-3 text-xs"
              disabled={isBusy || disabled}
              aria-label={t('guides.editPresentation', { language: presentation.language })}
              onClick={() => openEdit(presentation)}
            >
              {t('common.edit')}
            </Button>
          )}
        </div>
        {isEditing && <div className="mt-3">{renderEditor(presentation)}</div>}
      </li>
    );
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  return (
    <div className="space-y-4">
      {generalError && (
        <p className="text-sm text-destructive" role="alert">
          {generalError}
        </p>
      )}

      {!sourcePresentation ? (
        <p className="text-sm text-muted-foreground">{t('guides.presentationsEmpty')}</p>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Languages className="h-3.5 w-3.5" aria-hidden />
              {t('guides.sourcePresentation')}
            </div>
            <ul className="space-y-3">
              {renderPresentationCard(sourcePresentation, {
                emphasize: true,
                emptyHint: t('guides.sourcePresentationEmpty'),
              })}
            </ul>
          </div>

          {otherPresentations.length > 0 && (
            <div className="space-y-2 border-t border-border/50 pt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('guides.otherLanguages')}
              </div>
              <ul className="space-y-3">
                {otherPresentations.map((presentation) => renderPresentationCard(presentation))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};
