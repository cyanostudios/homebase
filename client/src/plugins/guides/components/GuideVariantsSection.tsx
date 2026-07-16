import { Check, Edit, Play, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

import { guidesApi } from '../api/guidesApi';
import { GuideAudioSection } from './GuideAudioSection';
import {
  isPublicationStatus,
  isStalenessStatus,
  isVariantType,
  PUBLICATION_STATUSES,
  VARIANT_TYPES,
  type GuideValidationError,
  type GuideVariantCreatePayload,
  type GuideVariantPresentation,
  type GuideVariantUpdatePayload,
  type VariantType,
} from '../types/guides';

type VariantFormMode =
  | { type: 'create' }
  | { type: 'edit'; variant: GuideVariantPresentation }
  | null;

interface GuideVariantsSectionProps {
  placeId: string;
  stopId: string;
  sourceLanguage: string;
  parentBusy?: boolean;
  hasActiveProductionJob?: boolean;
  productionBusy?: boolean;
  onStartVariantProduction?: (variant: GuideVariantPresentation) => void;
}

const defaultCreateForm = (sourceLanguage: string): GuideVariantCreatePayload => ({
  variantType: 'normal',
  language: sourceLanguage,
  presentationText: null,
  publicationStatus: 'draft',
});

export const GuideVariantsSection: React.FC<GuideVariantsSectionProps> = ({
  placeId,
  stopId,
  sourceLanguage,
  parentBusy = false,
  hasActiveProductionJob = false,
  productionBusy = false,
  onStartVariantProduction,
}) => {
  const { t } = useTranslation();
  const [variants, setVariants] = useState<GuideVariantPresentation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [formMode, setFormMode] = useState<VariantFormMode>(null);
  const [createForm, setCreateForm] = useState<GuideVariantCreatePayload>(
    defaultCreateForm(sourceLanguage),
  );
  const [updateForm, setUpdateForm] = useState<GuideVariantUpdatePayload>({
    presentationText: null,
    publicationStatus: 'draft',
  });
  const [validationErrors, setValidationErrors] = useState<GuideValidationError[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuideVariantPresentation | null>(null);

  const loadVariants = useCallback(async () => {
    setIsLoading(true);
    setGeneralError(null);
    try {
      const data = await guidesApi.getVariants(placeId, stopId);
      setVariants(data);
    } catch {
      setGeneralError(t('guides.variantsLoadFailed'));
      setVariants([]);
    } finally {
      setIsLoading(false);
    }
  }, [placeId, stopId, t]);

  useEffect(() => {
    void loadVariants();
  }, [loadVariants]);

  const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);

  const handleApiError = (err: unknown) => {
    const error = err as { errors?: GuideValidationError[]; status?: number };
    if (Array.isArray(error.errors)) {
      setValidationErrors(error.errors);
    } else if (error.status === 409) {
      setGeneralError(t('guides.variantConflict'));
    } else {
      setGeneralError(t('guides.variantsSaveFailed'));
    }
  };

  const openCreate = () => {
    setFormMode({ type: 'create' });
    setCreateForm(defaultCreateForm(sourceLanguage));
    setValidationErrors([]);
    setGeneralError(null);
  };

  const openEdit = (variant: GuideVariantPresentation) => {
    setFormMode({ type: 'edit', variant });
    setUpdateForm({
      presentationText: variant.presentationText,
      publicationStatus: variant.publicationStatus,
    });
    setValidationErrors([]);
    setGeneralError(null);
  };

  const closeForm = () => {
    setFormMode(null);
    setValidationErrors([]);
  };

  const handleSave = async () => {
    if (isBusy || parentBusy) return;
    setIsBusy(true);
    setValidationErrors([]);
    setGeneralError(null);
    try {
      if (formMode?.type === 'create') {
        const payload: GuideVariantCreatePayload = {
          variantType: createForm.variantType,
          language: createForm.language.trim().toLowerCase(),
          presentationText: createForm.presentationText?.trim()
            ? createForm.presentationText.trim()
            : null,
          publicationStatus: createForm.publicationStatus ?? 'draft',
        };
        if (!payload.language) {
          setValidationErrors([
            { field: 'language', message: t('guides.variantLanguageRequired') },
          ]);
          return;
        }
        await guidesApi.createVariant(placeId, stopId, payload);
      } else if (formMode?.type === 'edit') {
        const payload: GuideVariantUpdatePayload = {
          presentationText: updateForm.presentationText?.trim()
            ? updateForm.presentationText.trim()
            : null,
          publicationStatus: updateForm.publicationStatus ?? 'draft',
        };
        await guidesApi.updateVariant(placeId, stopId, formMode.variant.id, payload);
      }
      closeForm();
      await loadVariants();
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || isBusy || parentBusy) return;
    setIsBusy(true);
    setGeneralError(null);
    try {
      await guidesApi.deleteVariant(placeId, stopId, deleteTarget.id);
      setDeleteTarget(null);
      if (formMode?.type === 'edit' && formMode.variant.id === deleteTarget.id) {
        closeForm();
      }
      await loadVariants();
    } catch {
      setGeneralError(t('guides.variantsDeleteFailed'));
    } finally {
      setIsBusy(false);
    }
  };

  const renderCreateForm = () => (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`variant-type-create-${stopId}`}>{t('guides.variantType')}</Label>
          <NativeSelect
            id={`variant-type-create-${stopId}`}
            value={createForm.variantType}
            onChange={(e) =>
              setCreateForm((prev) => ({
                ...prev,
                variantType: e.target.value as VariantType,
              }))
            }
          >
            {VARIANT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`guides.variantTypes.${type}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor={`variant-lang-create-${stopId}`}>{t('guides.variantLanguage')}</Label>
          <Input
            id={`variant-lang-create-${stopId}`}
            value={createForm.language}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, language: e.target.value }))}
            placeholder={t('guides.variantLanguagePlaceholder')}
            className={cn(getFieldError('language') && 'border-destructive')}
          />
          {getFieldError('language') && (
            <p className="mt-1 text-sm text-destructive">{getFieldError('language')?.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor={`variant-text-create-${stopId}`}>{t('guides.presentationText')}</Label>
        <Textarea
          id={`variant-text-create-${stopId}`}
          value={createForm.presentationText ?? ''}
          onChange={(e) =>
            setCreateForm((prev) => ({
              ...prev,
              presentationText: e.target.value || null,
            }))
          }
          rows={4}
          placeholder={t('guides.presentationTextPlaceholder')}
          className={cn(getFieldError('presentationText') && 'border-destructive')}
        />
      </div>

      <div>
        <Label htmlFor={`variant-pub-create-${stopId}`}>{t('guides.publicationStatus')}</Label>
        <NativeSelect
          id={`variant-pub-create-${stopId}`}
          value={createForm.publicationStatus ?? 'draft'}
          onChange={(e) =>
            setCreateForm((prev) => ({
              ...prev,
              publicationStatus: e.target.value as GuideVariantCreatePayload['publicationStatus'],
            }))
          }
        >
          {PUBLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`guides.publication.${status}`)}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );

  const renderEditForm = () => {
    if (formMode?.type !== 'edit') return null;
    const variant = formMode.variant;
    const variantType = isVariantType(variant.variantType) ? variant.variantType : 'normal';

    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>{t('guides.variantType')}</Label>
            <div className="mt-1 text-sm">{t(`guides.variantTypes.${variantType}`)}</div>
          </div>
          <div>
            <Label>{t('guides.variantLanguage')}</Label>
            <div className="mt-1 text-sm uppercase">{variant.language}</div>
          </div>
        </div>

        <div>
          <Label htmlFor={`variant-text-edit-${variant.id}`}>{t('guides.presentationText')}</Label>
          <Textarea
            id={`variant-text-edit-${variant.id}`}
            value={updateForm.presentationText ?? ''}
            onChange={(e) =>
              setUpdateForm((prev) => ({
                ...prev,
                presentationText: e.target.value || null,
              }))
            }
            rows={4}
            placeholder={t('guides.presentationTextPlaceholder')}
            className={cn(getFieldError('presentationText') && 'border-destructive')}
          />
        </div>

        <div>
          <Label htmlFor={`variant-pub-edit-${variant.id}`}>{t('guides.publicationStatus')}</Label>
          <NativeSelect
            id={`variant-pub-edit-${variant.id}`}
            value={updateForm.publicationStatus ?? 'draft'}
            onChange={(e) =>
              setUpdateForm((prev) => ({
                ...prev,
                publicationStatus: e.target.value as GuideVariantUpdatePayload['publicationStatus'],
              }))
            }
          >
            {PUBLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`guides.publication.${status}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
    );
  };

  const renderForm = () => {
    if (!formMode) return null;
    const isCreate = formMode.type === 'create';

    return (
      <div className="rounded-md border border-border/60 bg-muted/20 p-3">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {isCreate ? t('guides.addVariant') : t('guides.editVariant')}
        </div>
        {isCreate ? renderCreateForm() : renderEditForm()}
        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={X}
            onClick={closeForm}
            disabled={isBusy || parentBusy}
            className="h-8 px-3 text-xs"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={Check}
            onClick={() => void handleSave()}
            disabled={isBusy || parentBusy}
            className="h-8 px-3 text-xs"
          >
            {t('common.save')}
          </Button>
        </div>
      </div>
    );
  };

  const disabled = isBusy || parentBusy;

  return (
    <div className="mt-4 border-t border-border/50 pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('guides.variants')}
          </p>
          {!isLoading && variants.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('guides.variantsCount', { count: variants.length })}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={Plus}
          onClick={openCreate}
          disabled={disabled || formMode?.type === 'create'}
          className="h-8 shrink-0 px-2 text-xs"
        >
          {t('guides.addVariant')}
        </Button>
      </div>

      {generalError && <p className="mb-2 text-xs text-destructive">{generalError}</p>}
      {renderForm()}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
      ) : variants.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">{t('guides.variantsNoYet')}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {variants.map((variant) => {
            const variantType = isVariantType(variant.variantType) ? variant.variantType : 'normal';
            const publicationStatus = isPublicationStatus(variant.publicationStatus)
              ? variant.publicationStatus
              : 'draft';
            const stalenessStatus = isStalenessStatus(variant.stalenessStatus)
              ? variant.stalenessStatus
              : 'fresh';
            const isEditingThis = formMode?.type === 'edit' && formMode.variant.id === variant.id;

            if (isEditingThis) {
              return null;
            }

            return (
              <li
                key={variant.id}
                className="rounded-md border border-border/60 bg-muted/10 px-3 py-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {t(`guides.variantTypes.${variantType}`)}
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {variant.language}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {t(`guides.publication.${publicationStatus}`)}
                      </Badge>
                      {stalenessStatus === 'stale' && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/50 text-[10px] text-amber-700 dark:text-amber-400"
                        >
                          {t('guides.staleness.stale')}
                        </Badge>
                      )}
                    </div>
                    {variant.presentationText ? (
                      <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                        {variant.presentationText}
                      </p>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">
                        {t('guides.presentationTextEmpty')}
                      </p>
                    )}
                    <GuideAudioSection
                      placeId={placeId}
                      stopId={stopId}
                      variantId={variant.id}
                      presentationText={variant.presentationText}
                      parentBusy={disabled}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {onStartVariantProduction && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={Play}
                        className="h-7 w-7 p-0"
                        disabled={disabled || hasActiveProductionJob || productionBusy}
                        onClick={() => onStartVariantProduction(variant)}
                        aria-label={t('guides.production.startVariantAria', {
                          type: t(`guides.variantTypes.${variantType}`),
                          language: variant.language,
                        })}
                        title={t('guides.production.startVariant')}
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Edit}
                      className="h-7 w-7 p-0"
                      disabled={disabled || formMode !== null}
                      onClick={() => openEdit(variant)}
                      aria-label={t('common.edit')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                      disabled={disabled}
                      onClick={() => setDeleteTarget(variant)}
                      aria-label={t('common.delete')}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={t('guides.deleteVariantTitle')}
        message={t('guides.deleteVariantDescription', {
          type: deleteTarget
            ? t(
                `guides.variantTypes.${isVariantType(deleteTarget.variantType) ? deleteTarget.variantType : 'normal'}`,
              )
            : '',
          language: deleteTarget?.language ?? '',
        })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        confirmDisabled={disabled}
      />
    </div>
  );
};
