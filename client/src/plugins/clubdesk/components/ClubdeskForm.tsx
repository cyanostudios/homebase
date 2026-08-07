import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Info,
  ListOrdered,
  Plus,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { pathToNavPage } from '@/core/routing/routeMap';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
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

import { useClubdesk } from '../hooks/useClubdesk';
import type {
  Clubdesk,
  ClubdeskPayload,
  ClubdeskStepPayload,
  PublicationStatus,
} from '../types/clubdesk';
import { copyStepAt, reorderSteps } from '../utils/clubdeskStepOps';

import { PriceListForm } from './PriceListForm';

function isEmptyRichText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim() === '';
}

interface ClubdeskFormProps {
  currentClubdesk?: Clubdesk | null;
  currentItem?: Clubdesk | null;
  onSave: (data: ClubdeskPayload) => Promise<boolean> | boolean;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function emptyStep(order: number): ClubdeskStepPayload {
  return {
    title: '',
    description: null,
    sequenceOrder: order,
    imageUrl: null,
  };
}

export const ClubdeskForm = React.forwardRef<PanelFormHandle, ClubdeskFormProps>(
  function ClubdeskForm(props, ref) {
    const location = useLocation();
    if (pathToNavPage(location.pathname) === 'clubdesk-price-list') {
      return <PriceListForm ref={ref} />;
    }
    return <ClubdeskGuideForm ref={ref} {...props} />;
  },
);

const ClubdeskGuideForm = React.forwardRef<PanelFormHandle, ClubdeskFormProps>(
  function ClubdeskGuideForm(
    { currentClubdesk, currentItem, onSave, onCancel, isSubmitting: externalIsSubmitting = false },
    ref,
  ) {
    const clubdesk = currentClubdesk ?? currentItem ?? null;
    const { t } = useTranslation();
    const {
      validationErrors,
      clearValidationErrors,
      panelMode,
      isSaving,
      categories,
      clubdesk: clubdeskGuides,
      createClubdeskCategory,
      reorderClubdeskCategories,
      deleteClubdeskCategory,
    } = useClubdesk();
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
    const [newCategoryName, setNewCategoryName] = useState('');
    const [categoryPendingDelete, setCategoryPendingDelete] = useState<string | null>(null);
    const [moveToCategory, setMoveToCategory] = useState<string>('__uncategorized__');
    const [categoryDeleteError, setCategoryDeleteError] = useState<string | null>(null);
    const [deletingCategory, setDeletingCategory] = useState(false);
    const [reorderingCategory, setReorderingCategory] = useState(false);
    const [categoryOrderNames, setCategoryOrderNames] = useState<string[] | null>(null);
    const [formData, setFormData] = useState<ClubdeskPayload>({
      title: '',
      slug: '',
      description: null,
      featuredImageUrl: null,
      category: null,
      publicationStatus: 'draft',
      steps: [],
    });

    const isCurrentlySubmitting = externalIsSubmitting || isSaving || isSubmitting;

    const categoryNameKey = (name: string | null | undefined) => (name || '').trim().toLowerCase();

    const orderedCategoryEntries = useMemo(() => {
      const serverSorted = [...categories].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'sv'),
      );
      const seen = new Set(serverSorted.map((c) => c.name.trim().toLowerCase()));
      const entries: Array<{ name: string; id: string | null }> = serverSorted.map((c) => ({
        name: c.name,
        id: c.id,
      }));
      const orphan = (formData.category || '').trim();
      if (orphan && !seen.has(orphan.toLowerCase())) {
        seen.add(orphan.toLowerCase());
        entries.push({ name: orphan, id: null });
      }

      if (!categoryOrderNames || categoryOrderNames.length === 0) {
        return entries;
      }

      const byKey = new Map(entries.map((entry) => [entry.name.trim().toLowerCase(), entry]));
      const ordered: Array<{ name: string; id: string | null }> = [];
      for (const name of categoryOrderNames) {
        const key = name.trim().toLowerCase();
        const entry = byKey.get(key);
        if (!entry) {
          continue;
        }
        ordered.push(entry);
        byKey.delete(key);
      }
      for (const entry of byKey.values()) {
        ordered.push(entry);
      }
      return ordered;
    }, [categories, formData.category, categoryOrderNames]);

    const categoryOptions = useMemo(
      () => orderedCategoryEntries.map((entry) => entry.name),
      [orderedCategoryEntries],
    );

    useEffect(() => {
      const formKey = `clubdesk-form-${clubdesk?.id || 'new'}`;
      registerUnsavedChangesChecker(formKey, () => isDirty);
      return () => unregisterUnsavedChangesChecker(formKey);
    }, [isDirty, clubdesk, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

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
      setCategoryOrderNames(null);
      setNewCategoryName('');
      markClean();
    }, [markClean]);

    useEffect(() => {
      if (clubdesk) {
        setFormData({
          title: clubdesk.title || '',
          slug: clubdesk.slug || '',
          description: clubdesk.description,
          featuredImageUrl: clubdesk.featuredImageUrl,
          category: clubdesk.category,
          publicationStatus: clubdesk.publicationStatus || 'draft',
          steps: (clubdesk.steps || []).map((step, index) => ({
            title: step.title || '',
            description: step.description ?? null,
            sequenceOrder: step.sequenceOrder ?? index + 1,
            imageUrl: step.imageUrl ?? null,
          })),
        });
        setSlugTouched(true);
        setCategoryOrderNames(null);
        markClean();
      } else {
        resetForm();
      }
    }, [clubdesk, markClean, resetForm]);

    const handleSubmit = useCallback(async () => {
      if (isCurrentlySubmitting) {
        return;
      }
      setIsSubmitting(true);
      try {
        const ok = await onSave(formData);
        if (ok) {
          markClean();
          if (!clubdesk) {
            resetForm();
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    }, [formData, onSave, markClean, clubdesk, resetForm, isCurrentlySubmitting]);

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
      if (!clubdesk) {
        resetForm();
        setTimeout(() => confirmDiscard(), 0);
      } else {
        confirmDiscard();
        onCancel();
      }
    };

    const getFieldError = (field: string) => validationErrors.find((err) => err.field === field);
    const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

    const updateField = <K extends keyof ClubdeskPayload>(field: K, value: ClubdeskPayload[K]) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: value };
        if (field === 'title' && !slugTouched && !clubdesk) {
          next.slug = slugify(String(value || ''));
        }
        return next;
      });
      markDirty();
      clearValidationErrors();
    };

    const updateStep = (index: number, patch: Partial<ClubdeskStepPayload>) => {
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

    const handleAddCategory = async () => {
      const name = newCategoryName.trim();
      if (!name) {
        return;
      }
      try {
        await createClubdeskCategory(name);
        setNewCategoryName('');
        setCategoryOrderNames((prev) => (prev ? [...prev, name] : null));
      } catch (err) {
        console.error('Failed to create category:', err);
      }
    };

    const countGuidesInCategory = useCallback(
      (name: string) => {
        const key = categoryNameKey(name);
        const fromList = clubdeskGuides.filter((g) => categoryNameKey(g.category) === key).length;
        const currentId = clubdesk?.id;
        if (currentId) {
          const listRow = clubdeskGuides.find((g) => g.id === currentId);
          const listHad = listRow ? categoryNameKey(listRow.category) === key : false;
          const formHas = categoryNameKey(formData.category) === key;
          if (listHad && !formHas) {
            return Math.max(0, fromList - 1);
          }
          if (!listHad && formHas) {
            return fromList + 1;
          }
          return fromList;
        }
        return fromList + (categoryNameKey(formData.category) === key ? 1 : 0);
      },
      [clubdeskGuides, clubdesk?.id, formData.category],
    );

    const reassignmentTargets = useMemo(() => {
      if (!categoryPendingDelete) {
        return [];
      }
      const pendingKey = categoryNameKey(categoryPendingDelete);
      return categoryOptions.filter((name) => categoryNameKey(name) !== pendingKey);
    }, [categoryOptions, categoryPendingDelete]);

    const completeCategoryDelete = useCallback(
      async (name: string, moveTo: string | null, withReassignment: boolean) => {
        const key = categoryNameKey(name);
        const serverCat = categories.find((c) => categoryNameKey(c.name) === key);
        if (!serverCat) {
          setCategoryOrderNames((prev) =>
            prev ? prev.filter((n) => categoryNameKey(n) !== key) : null,
          );
          setFormData((prev) =>
            categoryNameKey(prev.category) === key ? { ...prev, category: moveTo } : prev,
          );
          setCategoryPendingDelete(null);
          setMoveToCategory('__uncategorized__');
          setCategoryDeleteError(null);
          return;
        }
        setDeletingCategory(true);
        setCategoryDeleteError(null);
        try {
          if (withReassignment) {
            await deleteClubdeskCategory(serverCat.id, { moveToCategory: moveTo });
          } else {
            await deleteClubdeskCategory(serverCat.id);
          }
          setCategoryOrderNames((prev) =>
            prev ? prev.filter((n) => categoryNameKey(n) !== key) : null,
          );
          setFormData((prev) =>
            categoryNameKey(prev.category) === key ? { ...prev, category: moveTo } : prev,
          );
          setCategoryPendingDelete(null);
          setMoveToCategory('__uncategorized__');
          setCategoryDeleteError(null);
        } catch (err) {
          const apiErr = err as { status?: number; message?: string };
          const message = apiErr?.message || t('clubdesk.deleteGuideCategoryFailed');
          setCategoryDeleteError(message);
          if (apiErr?.status === 409) {
            const others = categoryOptions.filter((n) => categoryNameKey(n) !== key);
            setMoveToCategory(others[0] || '__uncategorized__');
            setCategoryPendingDelete(name);
          }
          console.error('Failed to delete category:', err);
        } finally {
          setDeletingCategory(false);
        }
      },
      [categories, categoryOptions, deleteClubdeskCategory, t],
    );

    const handleRequestDeleteCategory = (name: string) => {
      setCategoryDeleteError(null);
      const guideCount = countGuidesInCategory(name);
      if (guideCount === 0) {
        void completeCategoryDelete(name, null, false);
        return;
      }
      const others = categoryOptions.filter((n) => categoryNameKey(n) !== categoryNameKey(name));
      setMoveToCategory(others[0] || '__uncategorized__');
      setCategoryPendingDelete(name);
    };

    const handleConfirmDeleteCategory = () => {
      if (!categoryPendingDelete) {
        return;
      }
      const moveTo = moveToCategory === '__uncategorized__' ? null : moveToCategory.trim() || null;
      void completeCategoryDelete(categoryPendingDelete, moveTo, true);
    };

    const handleMoveCategory = async (index: number, direction: -1 | 1) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= orderedCategoryEntries.length) {
        return;
      }
      const next = [...orderedCategoryEntries];
      const tmp = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = tmp;

      setCategoryOrderNames(next.map((entry) => entry.name));

      const orderedIds = next.filter((entry) => entry.id).map((entry) => String(entry.id));
      if (orderedIds.length > 0) {
        setReorderingCategory(true);
        try {
          await reorderClubdeskCategories(orderedIds);
        } catch (err) {
          console.error('Failed to reorder categories:', err);
        } finally {
          setReorderingCategory(false);
        }
      }
    };

    const formSidebar = clubdesk ? (
      <div className="space-y-4">
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('clubdesk.information')}
            icon={Info}
            iconPlugin="clubdesk"
            subtleTitle
            className="p-4"
          >
            <div>
              <div className={DETAIL_INFO_ROW_CLASS}>
                <span className="text-slate-500 dark:text-slate-400">ID</span>
                <span className="font-mono font-semibold text-foreground">
                  {formatDisplayNumber('clubdesk', clubdesk.id)}
                </span>
              </div>
              <div className={DETAIL_INFO_ROW_CLASS}>
                <span className="text-slate-500 dark:text-slate-400">{t('common.created')}</span>
                <span className="font-mono font-semibold text-foreground">
                  {clubdesk.createdAt ? new Date(clubdesk.createdAt).toLocaleDateString() : '—'}
                </span>
              </div>
              <div className={DETAIL_INFO_ROW_CLASS}>
                <span className="text-slate-500 dark:text-slate-400">{t('common.updated')}</span>
                <span className="font-mono font-semibold text-foreground">
                  {clubdesk.updatedAt ? new Date(clubdesk.updatedAt).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          </DetailSection>
        </Card>
        <DetailActivityLog
          entityType="clubdesk"
          entityId={clubdesk.id}
          title={t('clubdesk.activity')}
          refreshKey={clubdesk.updatedAt}
        />
      </div>
    ) : undefined;

    return (
      <>
        <div className="plugin-clubdesk">
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
                  title={t('clubdesk.guideCard')}
                  iconPlugin="clubdesk"
                  className="p-6"
                >
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="clubdesk-title">{t('clubdesk.title')}</Label>
                      <Input
                        id="clubdesk-title"
                        value={formData.title}
                        onChange={(e) => updateField('title', e.target.value)}
                        placeholder={t('clubdesk.titlePlaceholder')}
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
                      <Label htmlFor="clubdesk-slug">{t('clubdesk.slug')}</Label>
                      <Input
                        id="clubdesk-slug"
                        value={formData.slug || ''}
                        onChange={(e) => {
                          setSlugTouched(true);
                          updateField('slug', e.target.value);
                        }}
                        placeholder={t('clubdesk.slugPlaceholder')}
                        className={cn(getFieldError('slug') && 'border-destructive')}
                      />
                      {getFieldError('slug') && (
                        <p className="mt-1 text-sm text-destructive">
                          {getFieldError('slug')?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="clubdesk-description">{t('clubdesk.description')}</Label>
                      <Textarea
                        id="clubdesk-description"
                        value={formData.description ?? ''}
                        onChange={(e) => updateField('description', e.target.value)}
                        rows={4}
                        placeholder={t('clubdesk.descriptionPlaceholder')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="clubdesk-featured">{t('clubdesk.featuredImageUrl')}</Label>
                      <Input
                        id="clubdesk-featured"
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
                      <Label htmlFor="clubdesk-status">{t('clubdesk.publicationStatus')}</Label>
                      <Select
                        value={formData.publicationStatus}
                        onValueChange={(value) =>
                          updateField('publicationStatus', value as PublicationStatus)
                        }
                      >
                        <SelectTrigger id="clubdesk-status" className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">{t('clubdesk.status.draft')}</SelectItem>
                          <SelectItem value="published">
                            {t('clubdesk.status.published')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </DetailSection>
              </Card>

              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection
                  title={t('clubdesk.guideCategoriesCard')}
                  icon={Tags}
                  iconPlugin="clubdesk"
                  className="p-6"
                >
                  <p className="mb-3 text-xs text-muted-foreground">
                    {t('clubdesk.guideCategoriesOrderHint')}
                  </p>
                  {categoryDeleteError && !categoryPendingDelete ? (
                    <p className="mb-3 text-xs text-destructive" role="alert">
                      {categoryDeleteError}
                    </p>
                  ) : null}
                  <div className="mb-3 space-y-2">
                    {orderedCategoryEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t('clubdesk.noGuideCategories')}
                      </p>
                    ) : (
                      orderedCategoryEntries.map((entry, index) => {
                        const isSelected =
                          categoryNameKey(formData.category) === categoryNameKey(entry.name);
                        return (
                          <div
                            key={`${entry.id ?? 'orphan'}-${entry.name}`}
                            className={cn(
                              'flex items-center gap-2 rounded-md border px-2 py-1.5',
                              isSelected
                                ? 'border-primary/40 bg-primary/5'
                                : 'border-border/50 bg-muted/20',
                            )}
                          >
                            <button
                              type="button"
                              className="min-w-0 flex-1 truncate text-left text-xs font-medium hover:underline"
                              aria-pressed={isSelected}
                              aria-label={t('clubdesk.assignGuideCategory', {
                                name: entry.name,
                              })}
                              onClick={() =>
                                updateField('category', isSelected ? null : entry.name)
                              }
                            >
                              {entry.name}
                            </button>
                            <div className="flex flex-shrink-0 items-center gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={ArrowUp}
                                className="h-7 w-7 px-0"
                                disabled={reorderingCategory || deletingCategory || index === 0}
                                aria-label={t('clubdesk.moveGuideCategoryUp', {
                                  name: entry.name,
                                })}
                                onClick={() => void handleMoveCategory(index, -1)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={ArrowDown}
                                className="h-7 w-7 px-0"
                                disabled={
                                  reorderingCategory ||
                                  deletingCategory ||
                                  index === orderedCategoryEntries.length - 1
                                }
                                aria-label={t('clubdesk.moveGuideCategoryDown', {
                                  name: entry.name,
                                })}
                                onClick={() => void handleMoveCategory(index, 1)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={Trash2}
                                className="h-7 w-7 px-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                aria-label={t('clubdesk.removeGuideCategory', {
                                  name: entry.name,
                                })}
                                onClick={() => handleRequestDeleteCategory(entry.name)}
                                disabled={deletingCategory || reorderingCategory || !entry.id}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder={t('clubdesk.addGuideCategoryPlaceholder')}
                      className="h-9 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleAddCategory();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                      className="h-9 px-3 text-xs"
                      onClick={() => void handleAddCategory()}
                    >
                      {t('clubdesk.addGuideCategory')}
                    </Button>
                  </div>
                </DetailSection>
              </Card>

              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection
                  title={t('clubdesk.stepsCard')}
                  icon={ListOrdered}
                  iconPlugin="clubdesk"
                  className="p-6"
                >
                  {getFieldError('steps') ? (
                    <p className="mb-3 text-sm text-destructive">
                      {getFieldError('steps')?.message}
                    </p>
                  ) : null}

                  {formData.steps.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
                      <p className="text-sm text-muted-foreground">{t('clubdesk.noStepsYet')}</p>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={Plus}
                        className="mt-3 h-9 px-3 text-xs"
                        onClick={addStep}
                      >
                        {t('clubdesk.addStep')}
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
                              {t('clubdesk.stepNumber', { number: index + 1 })}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={ArrowUp}
                                className="h-9 w-9 px-0"
                                disabled={index === 0}
                                aria-label={t('clubdesk.moveStepUp')}
                                onClick={() => moveStep(index, -1)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={ArrowDown}
                                className="h-9 w-9 px-0"
                                disabled={index === formData.steps.length - 1}
                                aria-label={t('clubdesk.moveStepDown')}
                                onClick={() => moveStep(index, 1)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={Copy}
                                className="h-9 w-9 px-0 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
                                aria-label={t('clubdesk.copyStep')}
                                onClick={() => copyStep(index)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={Trash2}
                                className="h-9 w-9 px-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                aria-label={t('clubdesk.removeStep')}
                                onClick={() => removeStep(index)}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Input
                              value={step.title}
                              onChange={(e) => updateStep(index, { title: e.target.value })}
                              placeholder={t('clubdesk.stepTitlePlaceholder')}
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
                                  placeholder={t('clubdesk.stepDescriptionPlaceholder')}
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
                                placeholder={t('clubdesk.stepDescriptionPlaceholder')}
                              />
                            </React.Suspense>
                            <Input
                              value={step.imageUrl ?? ''}
                              onChange={(e) => updateStep(index, { imageUrl: e.target.value })}
                              placeholder={t('clubdesk.stepImagePlaceholder')}
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
                        {t('clubdesk.addStep')}
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
          message={clubdesk ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
          confirmText={t('common.discard')}
          cancelText={t('common.continueEditing')}
          onConfirm={handleDiscardChanges}
          onCancel={cancelDiscard}
          variant="warning"
        />

        <AlertDialog
          open={Boolean(categoryPendingDelete)}
          onOpenChange={(open) => {
            if (!open && !deletingCategory) {
              setCategoryPendingDelete(null);
              setMoveToCategory('__uncategorized__');
              setCategoryDeleteError(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('clubdesk.deleteGuideCategoryTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('clubdesk.deleteGuideCategoryMessage', {
                  name: categoryPendingDelete || '',
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {categoryDeleteError ? (
              <p className="text-xs text-destructive" role="alert">
                {categoryDeleteError}
              </p>
            ) : null}
            <div className="py-2">
              <Label htmlFor="clubdesk-move-guide-category" className="text-xs">
                {t('clubdesk.reassignGuideCategory')}
              </Label>
              <Select value={moveToCategory} onValueChange={setMoveToCategory}>
                <SelectTrigger id="clubdesk-move-guide-category" className="mt-1 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__uncategorized__">{t('clubdesk.uncategorized')}</SelectItem>
                  {reassignmentTargets.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button
                  variant="secondary"
                  disabled={deletingCategory}
                  onClick={() => {
                    setCategoryPendingDelete(null);
                    setMoveToCategory('__uncategorized__');
                    setCategoryDeleteError(null);
                  }}
                >
                  {t('common.cancel')}
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  variant="destructive"
                  disabled={deletingCategory}
                  onClick={handleConfirmDeleteCategory}
                >
                  {deletingCategory ? t('common.saving') : t('common.delete')}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  },
);
