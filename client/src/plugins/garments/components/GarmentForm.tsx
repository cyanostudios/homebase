import { Check, Info, X } from 'lucide-react';
import React, { useState, useEffect, useCallback, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_INFO_ROW_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { formatDate } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useGarments } from '../hooks/useGarments';
import type {
  GarmentList,
  GarmentListPayload,
  InventoryItem,
  InventoryItemPayload,
} from '../types/garments';

interface GarmentFormProps {
  currentGarment?: GarmentList | null;
  currentItem?: GarmentList | null;
  onSave: (data: GarmentListPayload | InventoryItemPayload) => Promise<boolean> | boolean;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const GarmentForm = React.forwardRef<PanelFormHandle, GarmentFormProps>(function GarmentForm(
  {
    currentGarment: currentGarmentProp,
    currentItem,
    onSave,
    onCancel,
    isSubmitting: externalIsSubmitting = false,
  },
  ref,
) {
  const { t } = useTranslation();
  const {
    validationErrors,
    clearValidationErrors,
    panelMode,
    panelKind,
    isSaving,
    currentInventoryItem,
  } = useGarments();
  const enabledPlugins = useEnabledPlugins();
  const hasTeams = enabledPlugins.has('teams');
  const { teams } = useTeams();
  const {
    isDirty,
    showWarning,
    markDirty,
    markClean,
    attemptAction,
    confirmDiscard,
    cancelDiscard,
  } = useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const currentList = currentGarmentProp ?? currentItem ?? null;
  const isInventory = panelKind === 'inventory';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listForm, setListForm] = useState<GarmentListPayload>({
    name: '',
    teamId: null,
  });
  const [inventoryForm, setInventoryForm] = useState<InventoryItemPayload>({
    articleName: '',
    brand: '',
    size: '',
    quantity: 0,
    comment: null,
  });

  const isCurrentlySubmitting = externalIsSubmitting || isSaving || isSubmitting;
  const formKey = isInventory
    ? `garment-inventory-${currentInventoryItem?.id || 'new'}`
    : `garment-list-${currentList?.id || 'new'}`;

  useEffect(() => {
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [isDirty, formKey, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  const resetForm = useCallback(() => {
    setListForm({ name: '', teamId: null });
    setInventoryForm({
      articleName: '',
      brand: '',
      size: '',
      quantity: 0,
      comment: null,
    });
    markClean();
  }, [markClean]);

  useEffect(() => {
    if (isInventory) {
      if (currentInventoryItem) {
        setInventoryForm({
          articleName: currentInventoryItem.articleName,
          brand: currentInventoryItem.brand,
          size: currentInventoryItem.size,
          quantity: currentInventoryItem.quantity,
          comment: currentInventoryItem.comment,
        });
        markClean();
      } else {
        resetForm();
      }
      return;
    }
    if (currentList) {
      setListForm({
        name: currentList.name,
        teamId: currentList.teamId,
      });
      markClean();
    } else {
      resetForm();
    }
  }, [currentInventoryItem, currentList, isInventory, markClean, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (isCurrentlySubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      const ok = await onSave(isInventory ? inventoryForm : listForm);
      if (ok) {
        markClean();
        if (!(isInventory ? currentInventoryItem : currentList)) {
          resetForm();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    currentInventoryItem,
    currentList,
    inventoryForm,
    isCurrentlySubmitting,
    isInventory,
    listForm,
    markClean,
    onSave,
    resetForm,
  ]);

  const handleCancel = useCallback(() => {
    attemptAction(() => onCancel());
  }, [attemptAction, onCancel]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSubmit(),
      cancel: handleCancel,
    }),
    [handleSubmit, handleCancel],
  );

  const handleDiscardChanges = () => {
    if (!(isInventory ? currentInventoryItem : currentList)) {
      resetForm();
      setTimeout(() => confirmDiscard(), 0);
    } else {
      confirmDiscard();
      onCancel();
    }
  };

  const getFieldError = (field: string) => validationErrors.find((err) => err.field === field);
  const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

  const updateListField = (field: keyof GarmentListPayload, value: string | null) => {
    setListForm((prev) => ({ ...prev, [field]: value }));
    markDirty();
    clearValidationErrors();
  };

  const updateInventoryField = (
    field: keyof InventoryItemPayload,
    value: string | number | null,
  ) => {
    setInventoryForm((prev) => ({ ...prev, [field]: value }));
    markDirty();
    clearValidationErrors();
  };

  const sidebarItem: GarmentList | InventoryItem | null = isInventory
    ? currentInventoryItem
    : currentList;

  const formSidebar = sidebarItem ? (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('garments.information')}
          icon={Info}
          iconPlugin="garments"
          subtleTitle
          className="p-4"
          collapsible
        >
          <div>
            <div className={DETAIL_INFO_ROW_CLASS}>
              <span className="text-slate-500 dark:text-slate-400">ID</span>
              <span className="font-mono font-semibold text-foreground">
                {formatDisplayNumber('garments', sidebarItem.id)}
              </span>
            </div>
            {'createdAt' in sidebarItem && sidebarItem.createdAt ? (
              <div className={DETAIL_INFO_ROW_CLASS}>
                <span className="text-slate-500 dark:text-slate-400">{t('common.created')}</span>
                <span className="font-mono font-semibold text-foreground">
                  {formatDate(sidebarItem.createdAt)}
                </span>
              </div>
            ) : null}
            {'updatedAt' in sidebarItem && sidebarItem.updatedAt ? (
              <div className={DETAIL_INFO_ROW_CLASS}>
                <span className="text-slate-500 dark:text-slate-400">{t('common.updated')}</span>
                <span className="font-mono font-semibold text-foreground">
                  {formatDate(sidebarItem.updatedAt)}
                </span>
              </div>
            ) : null}
          </div>
        </DetailSection>
      </Card>
    </div>
  ) : undefined;

  return (
    <>
      <div className="plugin-garments">
        <DetailLayout sidebar={formSidebar}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            {hasBlockingErrors && (
              <Card className="shadow-none border-destructive/50 bg-destructive/5 p-4">
                <div className="text-sm font-medium text-destructive">{t('common.cannotSave')}</div>
                <ul className="mt-2 list-inside list-disc text-sm text-destructive/90">
                  {validationErrors
                    .filter((e) => !e.message.includes('Warning'))
                    .map((e) => (
                      <li key={`${e.field}-${e.message}`}>{e.message}</li>
                    ))}
                </ul>
              </Card>
            )}

            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection title={t('garments.details')} iconPlugin="garments" className="p-6">
                {isInventory ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="garment-article">{t('garments.articleName')}</Label>
                      <Input
                        id="garment-article"
                        value={inventoryForm.articleName}
                        onChange={(e) => updateInventoryField('articleName', e.target.value)}
                        className={cn(getFieldError('articleName') && 'border-destructive')}
                      />
                      {getFieldError('articleName') && (
                        <p className="mt-1 text-sm text-destructive">
                          {getFieldError('articleName')?.message}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="garment-brand">{t('garments.brand')}</Label>
                        <Input
                          id="garment-brand"
                          value={inventoryForm.brand ?? ''}
                          onChange={(e) => updateInventoryField('brand', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="garment-size">{t('garments.size')}</Label>
                        <Input
                          id="garment-size"
                          value={inventoryForm.size ?? ''}
                          onChange={(e) => updateInventoryField('size', e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="garment-qty">{t('garments.quantity')}</Label>
                      <Input
                        id="garment-qty"
                        type="number"
                        min={0}
                        value={inventoryForm.quantity ?? 0}
                        onChange={(e) =>
                          updateInventoryField('quantity', Number(e.target.value) || 0)
                        }
                        className={cn(getFieldError('quantity') && 'border-destructive')}
                      />
                      {getFieldError('quantity') && (
                        <p className="mt-1 text-sm text-destructive">
                          {getFieldError('quantity')?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="garment-inv-comment">{t('garments.comment')}</Label>
                      <Textarea
                        id="garment-inv-comment"
                        value={inventoryForm.comment ?? ''}
                        onChange={(e) => updateInventoryField('comment', e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="garment-name">{t('garments.name')}</Label>
                      <Input
                        id="garment-name"
                        value={listForm.name}
                        onChange={(e) => updateListField('name', e.target.value)}
                        className={cn(getFieldError('name') && 'border-destructive')}
                      />
                      {getFieldError('name') && (
                        <p className="mt-1 text-sm text-destructive">
                          {getFieldError('name')?.message}
                        </p>
                      )}
                    </div>
                    {hasTeams ? (
                      <div>
                        <Label htmlFor="garment-team">{t('garments.team')}</Label>
                        <Select
                          value={listForm.teamId ?? '__none__'}
                          onValueChange={(value) =>
                            updateListField('teamId', value === '__none__' ? null : value)
                          }
                        >
                          <SelectTrigger id="garment-team" className="h-9">
                            <SelectValue placeholder={t('garments.teamNone')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{t('garments.teamNone')}</SelectItem>
                            {teams.map((team) => (
                              <SelectItem key={team.id} value={String(team.id)}>
                                {formatTeamLabel(team)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    {!currentList ? (
                      <p className="text-sm text-muted-foreground">
                        {t('garments.defaultCheckboxesHint')}
                      </p>
                    ) : null}
                  </div>
                )}
              </DetailSection>
            </Card>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                onClick={handleCancel}
                disabled={isCurrentlySubmitting}
                className="h-9 px-3 text-xs"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={Check}
                onClick={() => void handleSubmit()}
                disabled={hasBlockingErrors || isCurrentlySubmitting}
                className="h-9 px-3 text-xs bg-green-600 hover:bg-green-700 text-white border-none"
              >
                {isCurrentlySubmitting
                  ? t('common.saving')
                  : panelMode === 'edit'
                    ? t('common.update')
                    : t('common.save')}
              </Button>
            </div>
          </form>
        </DetailLayout>
      </div>

      <ConfirmDialog
        isOpen={showWarning}
        title={t('dialog.unsavedChanges')}
        message={
          (isInventory ? currentInventoryItem : currentList)
            ? t('dialog.discardAndReturn')
            : t('dialog.discardAndClose')
        }
        confirmText={t('common.discard')}
        cancelText={t('common.continueEditing')}
        onConfirm={handleDiscardChanges}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </>
  );
});
