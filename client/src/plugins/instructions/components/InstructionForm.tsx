import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Info,
  ListOrdered,
  Plus,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
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
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout, PANEL_MAX_WIDTH } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_INFO_ROW_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
const RichTextEditor = React.lazy(() =>
  import('@/core/ui/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
);
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { slugify } from '@/core/utils/slugUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useInstructions } from '../hooks/useInstructions';
import type {
  Instruction,
  InstructionPayload,
  InstructionStepPayload,
  PublicationStatus,
} from '../types/instructions';
import { copyStepAt, reorderSteps } from '../utils/instructionStepOps';

function isEmptyRichText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim() === '';
}

interface InstructionFormProps {
  currentInstruction?: Instruction | null;
  currentItem?: Instruction | null;
  onSave: (data: InstructionPayload) => Promise<boolean> | boolean;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function emptyStep(order: number): InstructionStepPayload {
  return {
    title: '',
    description: null,
    sequenceOrder: order,
    imageUrl: null,
  };
}

export const InstructionForm = React.forwardRef<PanelFormHandle, InstructionFormProps>(
  function InstructionForm(
    {
      currentInstruction,
      currentItem,
      onSave,
      onCancel,
      isSubmitting: externalIsSubmitting = false,
    },
    ref,
  ) {
    const instruction = currentInstruction ?? currentItem ?? null;
    const { t } = useTranslation();
    const {
      validationErrors,
      clearValidationErrors,
      panelMode,
      isSaving,
      categories,
      openInstructionSettings,
    } = useInstructions();
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

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [slugTouched, setSlugTouched] = useState(false);
    const [formData, setFormData] = useState<InstructionPayload>({
      title: '',
      slug: '',
      description: null,
      featuredImageUrl: null,
      category: null,
      publicationStatus: 'draft',
      steps: [],
    });

    const isCurrentlySubmitting = externalIsSubmitting || isSaving || isSubmitting;

    const categoryOptions = useMemo(() => {
      const names = categories.map((c) => c.name);
      const current = (formData.category || '').trim();
      if (current && !names.some((n) => n.toLowerCase() === current.toLowerCase())) {
        return [current, ...names];
      }
      return names;
    }, [categories, formData.category]);

    useEffect(() => {
      const formKey = `instruction-form-${instruction?.id || 'new'}`;
      registerUnsavedChangesChecker(formKey, () => isDirty);
      return () => unregisterUnsavedChangesChecker(formKey);
    }, [isDirty, instruction, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

    const resetForm = useCallback(() => {
      setFormData({
        title: '',
        slug: '',
        description: null,
        featuredImageUrl: null,
        category: null,
        publicationStatus: 'draft',
        steps: [],
      });
      setSlugTouched(false);
      markClean();
    }, [markClean]);

    useEffect(() => {
      if (instruction) {
        setFormData({
          title: instruction.title || '',
          slug: instruction.slug || '',
          description: instruction.description,
          featuredImageUrl: instruction.featuredImageUrl,
          category: instruction.category,
          publicationStatus: instruction.publicationStatus || 'draft',
          steps: (instruction.steps || []).map((step, index) => ({
            title: step.title || '',
            description: step.description ?? null,
            sequenceOrder: step.sequenceOrder ?? index + 1,
            imageUrl: step.imageUrl ?? null,
          })),
        });
        setSlugTouched(true);
        markClean();
      } else {
        resetForm();
      }
    }, [instruction, markClean, resetForm]);

    const handleSubmit = useCallback(async () => {
      if (isCurrentlySubmitting) {
        return;
      }
      setIsSubmitting(true);
      try {
        const ok = await onSave(formData);
        if (ok) {
          markClean();
          if (!instruction) {
            resetForm();
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    }, [formData, onSave, markClean, instruction, resetForm, isCurrentlySubmitting]);

    const handleCancel = useCallback(() => {
      attemptAction(() => onCancel());
    }, [attemptAction, onCancel]);

    const handleOpenCategorySettings = useCallback(() => {
      attemptAction(() => openInstructionSettings({ tab: 'categories' }));
    }, [attemptAction, openInstructionSettings]);

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSubmit(),
        cancel: handleCancel,
      }),
      [handleSubmit, handleCancel],
    );

    const handleDiscardChanges = () => {
      if (!instruction) {
        resetForm();
        setTimeout(() => confirmDiscard(), 0);
      } else {
        confirmDiscard();
        onCancel();
      }
    };

    const getFieldError = (field: string) => validationErrors.find((err) => err.field === field);
    const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

    const updateField = <K extends keyof InstructionPayload>(
      field: K,
      value: InstructionPayload[K],
    ) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: value };
        if (field === 'title' && !slugTouched && !instruction) {
          next.slug = slugify(String(value || ''));
        }
        return next;
      });
      markDirty();
      clearValidationErrors();
    };

    const updateStep = (index: number, patch: Partial<InstructionStepPayload>) => {
      setFormData((prev) => ({
        ...prev,
        steps: prev.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
      }));
      markDirty();
      clearValidationErrors();
    };

    const addStep = () => {
      setFormData((prev) => ({
        ...prev,
        steps: [...prev.steps, emptyStep(prev.steps.length + 1)],
      }));
      markDirty();
      clearValidationErrors();
    };

    const removeStep = (index: number) => {
      setFormData((prev) => ({
        ...prev,
        steps: prev.steps
          .filter((_, i) => i !== index)
          .map((step, i) => ({ ...step, sequenceOrder: i + 1 })),
      }));
      markDirty();
      clearValidationErrors();
    };

    const moveStep = (index: number, direction: -1 | 1) => {
      setFormData((prev) => {
        const next = reorderSteps(prev.steps, index, direction);
        if (!next) {
          return prev;
        }
        return { ...prev, steps: next };
      });
      markDirty();
      clearValidationErrors();
    };

    const copyStep = (index: number) => {
      setFormData((prev) => {
        const next = copyStepAt(prev.steps, index);
        if (!next) {
          return prev;
        }
        return { ...prev, steps: next };
      });
      markDirty();
      clearValidationErrors();
    };

    const formSidebar = instruction ? (
      <div className="space-y-4">
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('instructions.information')}
            icon={Info}
            iconPlugin="instructions"
            subtleTitle
            className="p-4"
          >
            <div>
              <div className={DETAIL_INFO_ROW_CLASS}>
                <span className="text-slate-500 dark:text-slate-400">ID</span>
                <span className="font-mono font-semibold text-foreground">
                  {formatDisplayNumber('instructions', instruction.id)}
                </span>
              </div>
              <div className={DETAIL_INFO_ROW_CLASS}>
                <span className="text-slate-500 dark:text-slate-400">{t('common.created')}</span>
                <span className="font-mono font-semibold text-foreground">
                  {instruction.createdAt
                    ? new Date(instruction.createdAt).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              <div className={DETAIL_INFO_ROW_CLASS}>
                <span className="text-slate-500 dark:text-slate-400">{t('common.updated')}</span>
                <span className="font-mono font-semibold text-foreground">
                  {instruction.updatedAt
                    ? new Date(instruction.updatedAt).toLocaleDateString()
                    : '—'}
                </span>
              </div>
            </div>
          </DetailSection>
        </Card>
        <DetailActivityLog
          entityType="instruction"
          entityId={instruction.id}
          title={t('instructions.activity')}
          refreshKey={instruction.updatedAt}
        />
      </div>
    ) : undefined;

    return (
      <>
        <div className="plugin-instructions">
          <DetailLayout mainClassName={PANEL_MAX_WIDTH} sidebar={formSidebar}>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
            >
              {hasBlockingErrors && (
                <Card className="shadow-none border-destructive/50 bg-destructive/5 p-4">
                  <div className="text-sm font-medium text-destructive">
                    {t('common.cannotSave')}
                  </div>
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
                <DetailSection
                  title={t('instructions.guideCard')}
                  iconPlugin="instructions"
                  className="p-6"
                >
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="instruction-title">{t('instructions.title')}</Label>
                      <Input
                        id="instruction-title"
                        value={formData.title}
                        onChange={(e) => updateField('title', e.target.value)}
                        placeholder={t('instructions.titlePlaceholder')}
                        className={cn(getFieldError('title') && 'border-destructive')}
                        required
                      />
                      {getFieldError('title') && (
                        <p className="mt-1 text-sm text-destructive">
                          {getFieldError('title')?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="instruction-slug">{t('instructions.slug')}</Label>
                      <Input
                        id="instruction-slug"
                        value={formData.slug || ''}
                        onChange={(e) => {
                          setSlugTouched(true);
                          updateField('slug', e.target.value);
                        }}
                        placeholder={t('instructions.slugPlaceholder')}
                        className={cn(getFieldError('slug') && 'border-destructive')}
                      />
                      {getFieldError('slug') && (
                        <p className="mt-1 text-sm text-destructive">
                          {getFieldError('slug')?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="instruction-description">
                        {t('instructions.description')}
                      </Label>
                      <Textarea
                        id="instruction-description"
                        value={formData.description ?? ''}
                        onChange={(e) => updateField('description', e.target.value)}
                        rows={4}
                        placeholder={t('instructions.descriptionPlaceholder')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="instruction-featured">
                        {t('instructions.featuredImageUrl')}
                      </Label>
                      <Input
                        id="instruction-featured"
                        value={formData.featuredImageUrl ?? ''}
                        onChange={(e) => updateField('featuredImageUrl', e.target.value)}
                        placeholder="https://"
                      />
                      {formData.featuredImageUrl ? (
                        <img
                          src={formData.featuredImageUrl}
                          alt=""
                          className="mt-2 h-20 w-auto rounded-md object-cover"
                        />
                      ) : null}
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <Label htmlFor="instruction-category">{t('instructions.category')}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={Settings}
                          className="h-7 px-2 text-xs text-muted-foreground"
                          onClick={handleOpenCategorySettings}
                          title={t('instructions.manageCategories')}
                          aria-label={t('instructions.manageCategories')}
                        />
                      </div>
                      <Select
                        value={formData.category?.trim() ? formData.category : '__none__'}
                        onValueChange={(value) =>
                          updateField('category', value === '__none__' ? null : String(value))
                        }
                      >
                        <SelectTrigger id="instruction-category" className="h-9 text-xs">
                          <SelectValue placeholder={t('instructions.categoryPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t('instructions.categoryNone')}</SelectItem>
                          {categoryOptions.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="instruction-status">
                        {t('instructions.publicationStatus')}
                      </Label>
                      <Select
                        value={formData.publicationStatus}
                        onValueChange={(value) =>
                          updateField('publicationStatus', value as PublicationStatus)
                        }
                      >
                        <SelectTrigger id="instruction-status" className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">{t('instructions.status.draft')}</SelectItem>
                          <SelectItem value="published">
                            {t('instructions.status.published')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </DetailSection>
              </Card>

              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection
                  title={t('instructions.stepsCard')}
                  icon={ListOrdered}
                  iconPlugin="instructions"
                  className="p-6"
                >
                  {getFieldError('steps') ? (
                    <p className="mb-3 text-sm text-destructive">
                      {getFieldError('steps')?.message}
                    </p>
                  ) : null}

                  {formData.steps.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        {t('instructions.noStepsYet')}
                      </p>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={Plus}
                        className="mt-3 h-9 px-3 text-xs"
                        onClick={addStep}
                      >
                        {t('instructions.addStep')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.steps.map((step, index) => (
                        <div
                          key={`step-${index}`}
                          className="rounded-lg border border-border/60 bg-muted/20 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">
                              {t('instructions.stepNumber', { number: index + 1 })}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={ArrowUp}
                                className="h-9 w-9 px-0"
                                disabled={index === 0}
                                aria-label={t('instructions.moveStepUp')}
                                onClick={() => moveStep(index, -1)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={ArrowDown}
                                className="h-9 w-9 px-0"
                                disabled={index === formData.steps.length - 1}
                                aria-label={t('instructions.moveStepDown')}
                                onClick={() => moveStep(index, 1)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={Copy}
                                className="h-9 w-9 px-0 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
                                aria-label={t('instructions.copyStep')}
                                onClick={() => copyStep(index)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={Trash2}
                                className="h-9 w-9 px-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                aria-label={t('instructions.removeStep')}
                                onClick={() => removeStep(index)}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Input
                              value={step.title}
                              onChange={(e) => updateStep(index, { title: e.target.value })}
                              placeholder={t('instructions.stepTitlePlaceholder')}
                              className={cn(
                                'h-9',
                                getFieldError(`steps.${index}.title`) && 'border-destructive',
                              )}
                            />
                            <React.Suspense
                              fallback={
                                <textarea
                                  className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  disabled
                                  placeholder={t('instructions.stepDescriptionPlaceholder')}
                                />
                              }
                            >
                              <RichTextEditor
                                value={step.description ?? ''}
                                onChange={(html) => {
                                  updateStep(index, {
                                    description: isEmptyRichText(html) ? null : html,
                                  });
                                }}
                                placeholder={t('instructions.stepDescriptionPlaceholder')}
                              />
                            </React.Suspense>
                            <Input
                              value={step.imageUrl ?? ''}
                              onChange={(e) => updateStep(index, { imageUrl: e.target.value })}
                              placeholder={t('instructions.stepImagePlaceholder')}
                            />
                            {step.imageUrl ? (
                              <img
                                src={step.imageUrl}
                                alt=""
                                className="h-16 w-auto rounded-md object-cover"
                              />
                            ) : null}
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={Plus}
                        className="h-9 px-3 text-xs"
                        onClick={addStep}
                      >
                        {t('instructions.addStep')}
                      </Button>
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
          message={instruction ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
          confirmText={t('common.discard')}
          cancelText={t('common.continueEditing')}
          onConfirm={handleDiscardChanges}
          onCancel={cancelDiscard}
          variant="warning"
        />
      </>
    );
  },
);
