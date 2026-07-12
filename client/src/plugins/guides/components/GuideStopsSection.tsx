import { ArrowDown, ArrowUp, Check, Edit, Plus, Trash2, X } from 'lucide-react';
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
import { GuideVariantsSection } from './GuideVariantsSection';
import {
  GUIDE_STOP_EDITORIAL_STATUSES,
  isGuideStopEditorialStatus,
  type GuideStop,
  type GuideStopPayload,
  type GuideValidationError,
} from '../types/guides';

type FormMode = { type: 'create' } | { type: 'edit'; stop: GuideStop } | null;

interface GuideStopsSectionProps {
  placeId: string;
  sourceLanguage: string;
}

const emptyForm: GuideStopPayload = {
  title: '',
  canonicalNarrative: null,
  editorialStatus: 'draft',
};

export const GuideStopsSection: React.FC<GuideStopsSectionProps> = ({
  placeId,
  sourceLanguage,
}) => {
  const { t } = useTranslation();
  const [stops, setStops] = useState<GuideStop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formData, setFormData] = useState<GuideStopPayload>(emptyForm);
  const [validationErrors, setValidationErrors] = useState<GuideValidationError[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuideStop | null>(null);

  const loadStops = useCallback(async () => {
    setIsLoading(true);
    setGeneralError(null);
    try {
      const data = await guidesApi.getStops(placeId);
      setStops(data);
    } catch {
      setGeneralError(t('guides.stopsLoadFailed'));
      setStops([]);
    } finally {
      setIsLoading(false);
    }
  }, [placeId, t]);

  useEffect(() => {
    void loadStops();
  }, [loadStops]);

  const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);

  const handleApiError = (err: unknown) => {
    const error = err as { errors?: GuideValidationError[] };
    if (Array.isArray(error.errors)) {
      setValidationErrors(error.errors);
    } else {
      setGeneralError(t('guides.stopsSaveFailed'));
    }
  };

  const openCreate = () => {
    setFormMode({ type: 'create' });
    setFormData(emptyForm);
    setValidationErrors([]);
    setGeneralError(null);
  };

  const openEdit = (stop: GuideStop) => {
    setFormMode({ type: 'edit', stop });
    setFormData({
      title: stop.title,
      canonicalNarrative: stop.canonicalNarrative,
      editorialStatus: stop.editorialStatus,
    });
    setValidationErrors([]);
    setGeneralError(null);
  };

  const closeForm = () => {
    setFormMode(null);
    setFormData(emptyForm);
    setValidationErrors([]);
  };

  const handleSave = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setValidationErrors([]);
    setGeneralError(null);
    try {
      const payload: GuideStopPayload = {
        title: formData.title.trim(),
        canonicalNarrative: formData.canonicalNarrative?.trim()
          ? formData.canonicalNarrative.trim()
          : null,
        editorialStatus: formData.editorialStatus ?? 'draft',
      };
      if (!payload.title) {
        setValidationErrors([{ field: 'title', message: t('guides.stopTitleRequired') }]);
        return;
      }
      if (formMode?.type === 'create') {
        await guidesApi.createStop(placeId, payload);
      } else if (formMode?.type === 'edit') {
        await guidesApi.updateStop(placeId, formMode.stop.id, payload);
      }
      closeForm();
      await loadStops();
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || isBusy) return;
    setIsBusy(true);
    setGeneralError(null);
    try {
      await guidesApi.deleteStop(placeId, deleteTarget.id);
      setDeleteTarget(null);
      if (formMode?.type === 'edit' && formMode.stop.id === deleteTarget.id) {
        closeForm();
      }
      await loadStops();
    } catch {
      setGeneralError(t('guides.stopsDeleteFailed'));
    } finally {
      setIsBusy(false);
    }
  };

  const moveStop = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stops.length || isBusy) return;

    setIsBusy(true);
    setGeneralError(null);
    try {
      const reordered = [...stops];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      const saved = await guidesApi.reorderStops(
        placeId,
        reordered.map((stop) => stop.id),
      );
      setStops(saved);
    } catch {
      setGeneralError(t('guides.stopsReorderFailed'));
    } finally {
      setIsBusy(false);
    }
  };

  const renderForm = () => {
    if (!formMode) return null;
    const isCreate = formMode.type === 'create';

    return (
      <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {isCreate ? t('guides.addStop') : t('guides.editStop')}
        </div>
        <div className="space-y-3">
          <div>
            <Label htmlFor="guide-stop-title">{t('guides.stopTitle')}</Label>
            <Input
              id="guide-stop-title"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder={t('guides.stopTitlePlaceholder')}
              className={cn(getFieldError('title') && 'border-destructive')}
            />
            {getFieldError('title') && (
              <p className="mt-1 text-sm text-destructive">{getFieldError('title')?.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="guide-stop-narrative">{t('guides.canonicalNarrative')}</Label>
            <Textarea
              id="guide-stop-narrative"
              value={formData.canonicalNarrative ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  canonicalNarrative: e.target.value || null,
                }))
              }
              rows={5}
              placeholder={t('guides.canonicalNarrativePlaceholder')}
              className={cn(getFieldError('canonicalNarrative') && 'border-destructive')}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t('guides.canonicalNarrativeHint', { language: sourceLanguage })}
            </p>
            {getFieldError('canonicalNarrative') && (
              <p className="mt-1 text-sm text-destructive">
                {getFieldError('canonicalNarrative')?.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="guide-stop-editorial">{t('guides.stopEditorialStatus')}</Label>
            <NativeSelect
              id="guide-stop-editorial"
              value={formData.editorialStatus ?? 'draft'}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  editorialStatus: e.target.value as GuideStopPayload['editorialStatus'],
                }))
              }
            >
              {GUIDE_STOP_EDITORIAL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`guides.editorial.${status}`)}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={X}
              onClick={closeForm}
              disabled={isBusy}
              className="h-9 px-3 text-xs"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={Check}
              onClick={() => void handleSave()}
              disabled={isBusy}
              className="h-9 px-3 text-xs"
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {stops.length === 0 && !isLoading
            ? t('guides.stopsNoYet')
            : t('guides.stopsCount', { count: stops.length })}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={Plus}
          onClick={openCreate}
          disabled={isBusy || formMode?.type === 'create'}
          className="h-9 shrink-0 px-3 text-xs"
        >
          {t('guides.addStop')}
        </Button>
      </div>

      {generalError && <p className="text-sm text-destructive">{generalError}</p>}
      {renderForm()}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : stops.length > 0 ? (
        <ul className="space-y-2">
          {stops.map((stop, index) => {
            const editorialStatus = isGuideStopEditorialStatus(stop.editorialStatus)
              ? stop.editorialStatus
              : 'draft';
            const isEditingThis = formMode?.type === 'edit' && formMode.stop.id === stop.id;

            if (isEditingThis) {
              return null;
            }

            return (
              <li
                key={stop.id}
                className="rounded-lg border border-border/70 bg-card p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        #{stop.sequenceOrder}
                      </Badge>
                      <span className="font-medium">{stop.title}</span>
                      <Badge variant="secondary">{t(`guides.editorial.${editorialStatus}`)}</Badge>
                    </div>
                    {stop.canonicalNarrative ? (
                      <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                        {stop.canonicalNarrative}
                      </p>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">
                        {t('guides.canonicalNarrativeEmpty')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 self-start">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={ArrowUp}
                      className="h-8 w-8 p-0"
                      disabled={isBusy || index === 0}
                      onClick={() => void moveStop(index, 'up')}
                      aria-label={t('guides.moveStopUp')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={ArrowDown}
                      className="h-8 w-8 p-0"
                      disabled={isBusy || index === stops.length - 1}
                      onClick={() => void moveStop(index, 'down')}
                      aria-label={t('guides.moveStopDown')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Edit}
                      className="h-8 w-8 p-0"
                      disabled={isBusy || formMode !== null}
                      onClick={() => openEdit(stop)}
                      aria-label={t('common.edit')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                      disabled={isBusy}
                      onClick={() => setDeleteTarget(stop)}
                      aria-label={t('common.delete')}
                    />
                  </div>
                </div>
                <GuideVariantsSection
                  placeId={placeId}
                  stopId={stop.id}
                  sourceLanguage={sourceLanguage}
                  parentBusy={isBusy || formMode !== null}
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={t('guides.deleteStopTitle')}
        message={t('guides.deleteStopDescription', { title: deleteTarget?.title ?? '' })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        confirmDisabled={isBusy}
      />
    </div>
  );
};
