import { Check, ChevronDown, ChevronRight, Edit, Languages, Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  GUIDE_APPROVAL_COLORS,
  GUIDE_LANGUAGE_BADGE_CLASS,
  GUIDE_LANGUAGE_SOURCE_BADGE_CLASS,
  GUIDE_PUBLICATION_COLORS,
  GUIDE_STALENESS_COLORS,
  SUGGESTED_GUIDE_LANGUAGES,
  type GuidePresentation,
  type GuidePresentationUpdatePayload,
  type GuideValidationError,
} from '../types/guides';

/** Common ISO 639-1 codes offered in the add-language picker. */
const SUGGESTED_LANGUAGES = SUGGESTED_GUIDE_LANGUAGES;

interface GuidePresentationSectionProps {
  placeId: string;
  sourceLanguage: string;
  disabled?: boolean;
  /** Bump to reload presentations (e.g. after production approve). */
  refreshKey?: string;
  /** Called whenever the presentation list changes. */
  onPresentationsChange?: (presentations: GuidePresentation[]) => void;
}

export const GuidePresentationSection: React.FC<GuidePresentationSectionProps> = ({
  placeId,
  sourceLanguage,
  disabled = false,
  refreshKey = '',
  onPresentationsChange,
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
  const [showAddLanguage, setShowAddLanguage] = useState(false);
  const [newLanguage, setNewLanguage] = useState('');
  const [addLanguageError, setAddLanguageError] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    onPresentationsChange?.(presentations);
  }, [presentations, onPresentationsChange]);

  const loadPresentations = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoading(true);
      }
      setGeneralError(null);
      try {
        const data = await guidesApi.getPresentations(placeId);
        setPresentations(data);
        // Always start collapsed on full load; user expands as needed
        if (!options?.silent) {
          setCollapsedIds(new Set(data.map((p) => p.id)));
        }
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

  const existingLanguages = useMemo(
    () => new Set(presentations.map((p) => p.language.toLowerCase())),
    [presentations],
  );

  const availableSuggestedLanguages = useMemo(
    () => SUGGESTED_LANGUAGES.filter((code) => !existingLanguages.has(code)),
    [existingLanguages],
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

  const handleAddLanguage = async () => {
    const code = newLanguage.trim().toLowerCase();
    setAddLanguageError(null);
    if (!/^[a-z]{2}(-[a-z]{2})?$/.test(code)) {
      setAddLanguageError(t('guides.addLanguageInvalid'));
      return;
    }
    if (existingLanguages.has(code)) {
      setAddLanguageError(t('guides.addLanguageExists'));
      return;
    }

    setIsBusy(true);
    try {
      const created = await guidesApi.createPresentation(placeId, code);
      setPresentations((prev) => {
        if (prev.some((p) => p.id === created.id)) return prev;
        return [...prev, created].sort((a, b) => a.language.localeCompare(b.language));
      });
      setNewLanguage('');
      setShowAddLanguage(false);
    } catch {
      setAddLanguageError(t('guides.addLanguageFailed'));
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
        <Badge
          className={
            presentation.language.toLowerCase() === sourceLanguage.toLowerCase()
              ? GUIDE_LANGUAGE_SOURCE_BADGE_CLASS
              : GUIDE_LANGUAGE_BADGE_CLASS
          }
        >
          {presentation.language}
        </Badge>
        <Badge className={GUIDE_PUBLICATION_COLORS[publication]}>
          {t(`guides.publication.${publication}`)}
        </Badge>
        <Badge className={GUIDE_STALENESS_COLORS[staleness]}>
          {t(`guides.staleness.${staleness}`)}
        </Badge>
        <Badge className={GUIDE_APPROVAL_COLORS[approval]}>
          {t(`guides.approval.${approval}`)}
        </Badge>
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
    const isCollapsed = collapsedIds.has(presentation.id) && !isEditing;
    const toggleCollapsed = () => {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(presentation.id)) next.delete(presentation.id);
        else next.add(presentation.id);
        return next;
      });
    };

    return (
      <li
        key={presentation.id}
        className={cn(
          'rounded-lg border border-border/70 bg-card',
          options?.emphasize && 'border-primary/20',
        )}
      >
        <button
          type="button"
          className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-lg"
          onClick={toggleCollapsed}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <div className="min-w-0 flex-1">{renderStatusBadges(presentation)}</div>
          {isCollapsed && text && (
            <span className="ml-2 truncate max-w-[200px] text-xs text-muted-foreground">
              {text.slice(0, 80)}
              {text.length > 80 ? '…' : ''}
            </span>
          )}
        </button>

        {!isCollapsed && (
          <div className="px-4 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
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
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(presentation);
                  }}
                >
                  {t('common.edit')}
                </Button>
              )}
            </div>
            {isEditing && <div className="mt-3">{renderEditor(presentation)}</div>}
          </div>
        )}
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

          <div className="space-y-2 border-t border-border/50 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('guides.otherLanguages')}
              </div>
              {!showAddLanguage && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  className="h-8 px-3 text-xs"
                  disabled={isBusy || disabled}
                  onClick={() => {
                    setShowAddLanguage(true);
                    setAddLanguageError(null);
                    setNewLanguage(availableSuggestedLanguages[0] ?? '');
                  }}
                >
                  {t('guides.addLanguage')}
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">{t('guides.addLanguageHint')}</p>

            {showAddLanguage && (
              <div className="space-y-3 rounded-md border border-border/70 bg-muted/10 p-4">
                <div className="space-y-2">
                  <Label htmlFor="guide-add-language">{t('guides.addLanguageLabel')}</Label>
                  {availableSuggestedLanguages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {availableSuggestedLanguages.map((code) => (
                        <Button
                          key={code}
                          type="button"
                          variant={newLanguage === code ? 'primary' : 'secondary'}
                          size="sm"
                          className="h-7 px-2 text-xs uppercase"
                          disabled={isBusy || disabled}
                          onClick={() => {
                            setNewLanguage(code);
                            setAddLanguageError(null);
                          }}
                        >
                          {code}
                        </Button>
                      ))}
                    </div>
                  )}
                  <Input
                    id="guide-add-language"
                    value={newLanguage}
                    disabled={isBusy || disabled}
                    placeholder={t('guides.addLanguagePlaceholder')}
                    maxLength={10}
                    onChange={(e) => {
                      setNewLanguage(e.target.value.toLowerCase());
                      setAddLanguageError(null);
                    }}
                  />
                  {addLanguageError && (
                    <p className="text-xs text-destructive" role="alert">
                      {addLanguageError}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    className="h-8 px-3 text-xs"
                    disabled={isBusy || disabled || !newLanguage.trim()}
                    onClick={() => void handleAddLanguage()}
                  >
                    {t('guides.addLanguageConfirm')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={X}
                    className="h-8 px-3 text-xs"
                    disabled={isBusy}
                    onClick={() => {
                      setShowAddLanguage(false);
                      setAddLanguageError(null);
                      setNewLanguage('');
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}

            {otherPresentations.length > 0 ? (
              <ul className="space-y-3">
                {otherPresentations.map((presentation) =>
                  renderPresentationCard(presentation, {
                    emptyHint: t('guides.otherLanguageEmpty'),
                  }),
                )}
              </ul>
            ) : (
              !showAddLanguage && (
                <p className="text-sm text-muted-foreground">{t('guides.otherLanguagesEmpty')}</p>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
};
