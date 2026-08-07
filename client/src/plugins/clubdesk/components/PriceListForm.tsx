import { ArrowDown, ArrowUp, Check, Copy, Info, Plus, Tags, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_INFO_ROW_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { slugify } from '@/core/utils/slugUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useClubdesk } from '../hooks/useClubdesk';
import type { PublicationStatus } from '../types/clubdesk';
import type { ClubdeskPriceListItemPayload, ClubdeskPriceListPayload } from '../types/priceList';
import { copyItemAt, reorderItems } from '../utils/priceListItemOps';

function isEmptyRichText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim() === '';
}

function emptyItem(order: number): ClubdeskPriceListItemPayload {
  return {
    title: '',
    description: null,
    price: 0,
    category: null,
    sequenceOrder: order,
  };
}

export const PriceListForm = React.forwardRef<PanelFormHandle>(function PriceListForm(_props, ref) {
  const { t } = useTranslation();
  const {
    currentPriceList,
    validationErrors,
    clearValidationErrors,
    panelMode,
    isSaving,
    priceListCategories,
    savePriceList,
    closeClubdeskPanel,
    createPriceListCategory,
    reorderPriceListCategories,
    deletePriceListCategory,
  } = useClubdesk();
  const priceList = currentPriceList;
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
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  /** Preserves mixed local/server category order after drag via arrows. */
  const [categoryOrderNames, setCategoryOrderNames] = useState<string[] | null>(null);
  const [categoryPendingDelete, setCategoryPendingDelete] = useState<string | null>(null);
  const [moveToCategory, setMoveToCategory] = useState<string>('__uncategorized__');
  const [categoryDeleteError, setCategoryDeleteError] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);
  const [reorderingCategory, setReorderingCategory] = useState(false);
  const [formData, setFormData] = useState<ClubdeskPriceListPayload>({
    title: '',
    slug: '',
    description: null,
    featuredImageUrl: null,
    publicationStatus: 'draft',
    currency: 'SEK',
    items: [],
  });

  const isCurrentlySubmitting = isSaving || isSubmitting;

  /** Catalog order first (for public/kiosk), then local-only names, then orphan item categories. */
  const orderedCategoryEntries = useMemo(() => {
    const serverSorted = [...priceListCategories].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'sv'),
    );
    const seen = new Set(serverSorted.map((c) => c.name.trim().toLowerCase()));
    const entries: Array<{ name: string; id: string | null }> = serverSorted.map((c) => ({
      name: c.name,
      id: c.id,
    }));
    for (const name of localCategories) {
      const key = name.trim().toLowerCase();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      entries.push({ name: name.trim(), id: null });
    }
    for (const item of formData.items) {
      const name = (item.category || '').trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) {
        continue;
      }
      seen.add(key);
      entries.push({ name, id: null });
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
  }, [priceListCategories, localCategories, formData.items, categoryOrderNames]);

  const categoryOptions = useMemo(
    () => orderedCategoryEntries.map((entry) => entry.name),
    [orderedCategoryEntries],
  );

  useEffect(() => {
    const formKey = `price-list-form-${priceList?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [isDirty, priceList, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      slug: '',
      description: null,
      featuredImageUrl: null,
      publicationStatus: 'draft',
      currency: 'SEK',
      items: [],
    });
    setSlugTouched(false);
    setLocalCategories([]);
    setCategoryOrderNames(null);
    setNewCategoryName('');
    markClean();
  }, [markClean]);

  useEffect(() => {
    if (priceList) {
      setFormData({
        title: priceList.title || '',
        slug: priceList.slug || '',
        description: priceList.description,
        featuredImageUrl: priceList.featuredImageUrl,
        publicationStatus: priceList.publicationStatus || 'draft',
        currency: priceList.currency || 'SEK',
        items: (priceList.items || []).map((item, index) => ({
          title: item.title || '',
          description: item.description ?? null,
          price: Number(item.price) || 0,
          category: item.category ?? null,
          sequenceOrder: item.sequenceOrder ?? index + 1,
        })),
      });
      setSlugTouched(true);
      setLocalCategories([]);
      setCategoryOrderNames(null);
      markClean();
    } else {
      resetForm();
    }
  }, [priceList, markClean, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (isCurrentlySubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      const ok = await savePriceList(formData, {
        categoryNames: orderedCategoryEntries.map((entry) => entry.name),
      });
      if (ok) {
        markClean();
        if (!priceList) {
          resetForm();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    formData,
    orderedCategoryEntries,
    savePriceList,
    markClean,
    priceList,
    resetForm,
    isCurrentlySubmitting,
  ]);

  const handleCancel = useCallback(() => {
    attemptAction(() => closeClubdeskPanel());
  }, [attemptAction, closeClubdeskPanel]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSubmit(),
      cancel: handleCancel,
    }),
    [handleSubmit, handleCancel],
  );

  const handleDiscardChanges = () => {
    if (!priceList) {
      resetForm();
      setTimeout(() => confirmDiscard(), 0);
    } else {
      confirmDiscard();
      closeClubdeskPanel();
    }
  };

  const getFieldError = (field: string) => validationErrors.find((err) => err.field === field);
  const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

  const updateField = <K extends keyof ClubdeskPriceListPayload>(
    field: K,
    value: ClubdeskPriceListPayload[K],
  ) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'title' && !slugTouched && !priceList) {
        next.slug = slugify(String(value || ''));
      }
      return next;
    });
    markDirty();
    clearValidationErrors();
  };

  const updateItem = (index: number, patch: Partial<ClubdeskPriceListItemPayload>) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
    markDirty();
    clearValidationErrors();
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, emptyItem(prev.items.length + 1)],
    }));
    markDirty();
    clearValidationErrors();
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, sequenceOrder: i + 1 })),
    }));
    markDirty();
    clearValidationErrors();
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    setFormData((prev) => {
      const next = reorderItems(prev.items, index, direction);
      if (!next) {
        return prev;
      }
      return { ...prev, items: next };
    });
    markDirty();
    clearValidationErrors();
  };

  const copyItem = (index: number) => {
    setFormData((prev) => {
      const next = copyItemAt(prev.items, index);
      if (!next) {
        return prev;
      }
      return { ...prev, items: next };
    });
    markDirty();
    clearValidationErrors();
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      return;
    }
    if (priceList?.id) {
      try {
        await createPriceListCategory(priceList.id, name);
        setNewCategoryName('');
        setCategoryOrderNames((prev) => (prev ? [...prev, name] : null));
      } catch (err) {
        console.error('Failed to create category:', err);
      }
    } else {
      setLocalCategories((prev) =>
        prev.some((n) => n.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name],
      );
      setCategoryOrderNames((prev) => (prev ? [...prev, name] : null));
      setNewCategoryName('');
    }
    markDirty();
  };

  const categoryNameKey = (name: string | null | undefined) => (name || '').trim().toLowerCase();

  const countItemsInCategory = useCallback(
    (name: string) => {
      const key = categoryNameKey(name);
      return formData.items.filter((item) => categoryNameKey(item.category) === key).length;
    },
    [formData.items],
  );

  const reassignmentTargets = useMemo(() => {
    if (!categoryPendingDelete) {
      return [];
    }
    const pendingKey = categoryNameKey(categoryPendingDelete);
    return categoryOptions.filter((name) => categoryNameKey(name) !== pendingKey);
  }, [categoryOptions, categoryPendingDelete]);

  const applyCategoryRemovalLocally = useCallback(
    (name: string, moveTo: string | null) => {
      const key = categoryNameKey(name);
      setFormData((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          categoryNameKey(item.category) === key ? { ...item, category: moveTo } : item,
        ),
      }));
      setLocalCategories((prev) => prev.filter((n) => categoryNameKey(n) !== key));
      setCategoryOrderNames((prev) =>
        prev ? prev.filter((n) => categoryNameKey(n) !== key) : null,
      );
      markDirty();
      clearValidationErrors();
    },
    [markDirty, clearValidationErrors],
  );

  const completeCategoryDelete = useCallback(
    async (name: string, moveTo: string | null, withReassignment: boolean) => {
      const key = categoryNameKey(name);
      const serverCat = priceListCategories.find((c) => categoryNameKey(c.name) === key);
      setDeletingCategory(true);
      setCategoryDeleteError(null);
      try {
        if (priceList?.id && serverCat) {
          if (withReassignment) {
            await deletePriceListCategory(priceList.id, serverCat.id, {
              moveToCategory: moveTo,
            });
          } else {
            await deletePriceListCategory(priceList.id, serverCat.id);
          }
        }
        applyCategoryRemovalLocally(name, moveTo);
        setCategoryPendingDelete(null);
        setMoveToCategory('__uncategorized__');
        setCategoryDeleteError(null);
      } catch (err) {
        const apiErr = err as { status?: number; message?: string };
        const message = apiErr?.message || t('clubdesk.priceList.deleteCategoryFailed');
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
    [
      priceList?.id,
      priceListCategories,
      deletePriceListCategory,
      applyCategoryRemovalLocally,
      categoryOptions,
      t,
    ],
  );

  const handleRequestDeleteCategory = (name: string) => {
    setCategoryDeleteError(null);
    const itemCount = countItemsInCategory(name);
    if (itemCount === 0) {
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

    const serverOrdered = next.filter((entry) => entry.id);
    const localOrdered = next.filter((entry) => !entry.id).map((entry) => entry.name);

    setCategoryOrderNames(next.map((entry) => entry.name));
    setLocalCategories(localOrdered);

    if (priceList?.id && serverOrdered.length > 0) {
      setReorderingCategory(true);
      try {
        await reorderPriceListCategories(
          priceList.id,
          serverOrdered.map((entry) => String(entry.id)),
        );
      } catch (err) {
        console.error('Failed to reorder categories:', err);
      } finally {
        setReorderingCategory(false);
      }
    }
    markDirty();
  };

  const formSidebar = priceList ? (
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
                {formatDisplayNumber('clubdesk', priceList.id)}
              </span>
            </div>
            <div className={DETAIL_INFO_ROW_CLASS}>
              <span className="text-slate-500 dark:text-slate-400">{t('common.created')}</span>
              <span className="font-mono font-semibold text-foreground">
                {priceList.createdAt ? new Date(priceList.createdAt).toLocaleDateString() : '—'}
              </span>
            </div>
            <div className={DETAIL_INFO_ROW_CLASS}>
              <span className="text-slate-500 dark:text-slate-400">{t('common.updated')}</span>
              <span className="font-mono font-semibold text-foreground">
                {priceList.updatedAt ? new Date(priceList.updatedAt).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </DetailSection>
      </Card>
      <DetailActivityLog
        entityType="clubdesk"
        entityId={priceList.id}
        title={t('clubdesk.activity')}
        refreshKey={priceList.updatedAt}
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
              <DetailSection
                title={t('clubdesk.priceList.card')}
                iconPlugin="clubdesk"
                className="p-6"
              >
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="price-list-title">{t('clubdesk.priceList.title')}</Label>
                    <Input
                      id="price-list-title"
                      value={formData.title}
                      onChange={(e) => updateField('title', e.target.value)}
                      placeholder={t('clubdesk.priceList.titlePlaceholder')}
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
                    <Label htmlFor="price-list-slug">{t('clubdesk.priceList.slug')}</Label>
                    <Input
                      id="price-list-slug"
                      value={formData.slug || ''}
                      onChange={(e) => {
                        setSlugTouched(true);
                        updateField('slug', e.target.value);
                      }}
                      placeholder={t('clubdesk.priceList.slugPlaceholder')}
                      className={cn(getFieldError('slug') && 'border-destructive')}
                    />
                    {getFieldError('slug') && (
                      <p className="mt-1 text-sm text-destructive">
                        {getFieldError('slug')?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="price-list-description">
                      {t('clubdesk.priceList.description')}
                    </Label>
                    <Textarea
                      id="price-list-description"
                      value={formData.description ?? ''}
                      onChange={(e) => updateField('description', e.target.value)}
                      rows={4}
                      placeholder={t('clubdesk.priceList.descriptionPlaceholder')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="price-list-featured">
                      {t('clubdesk.priceList.featuredImageUrl')}
                    </Label>
                    <Input
                      id="price-list-featured"
                      value={formData.featuredImageUrl ?? ''}
                      onChange={(e) => updateField('featuredImageUrl', e.target.value)}
                      placeholder="https://"
                    />
                  </div>
                  <div>
                    <Label htmlFor="price-list-currency">{t('clubdesk.priceList.currency')}</Label>
                    <Input
                      id="price-list-currency"
                      value={formData.currency}
                      onChange={(e) => updateField('currency', e.target.value.toUpperCase())}
                      placeholder="SEK"
                      className={cn(getFieldError('currency') && 'border-destructive')}
                    />
                    {getFieldError('currency') && (
                      <p className="mt-1 text-sm text-destructive">
                        {getFieldError('currency')?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="price-list-status">{t('clubdesk.publicationStatus')}</Label>
                    <Select
                      value={formData.publicationStatus}
                      onValueChange={(value) =>
                        updateField('publicationStatus', value as PublicationStatus)
                      }
                    >
                      <SelectTrigger id="price-list-status" className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">{t('clubdesk.status.draft')}</SelectItem>
                        <SelectItem value="published">{t('clubdesk.status.published')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DetailSection>
            </Card>

            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('clubdesk.priceList.categoriesCard')}
                icon={Tags}
                iconPlugin="clubdesk"
                className="p-6"
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  {t('clubdesk.priceList.categoriesOrderHint')}
                </p>
                {categoryDeleteError && !categoryPendingDelete ? (
                  <p className="mb-3 text-xs text-destructive" role="alert">
                    {categoryDeleteError}
                  </p>
                ) : null}
                <div className="mb-3 space-y-2">
                  {orderedCategoryEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t('clubdesk.priceList.noCategories')}
                    </p>
                  ) : (
                    orderedCategoryEntries.map((entry, index) => (
                      <div
                        key={`${entry.id ?? 'local'}-${entry.name}`}
                        className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-2 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                          {entry.name}
                        </span>
                        <div className="flex flex-shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            icon={ArrowUp}
                            className="h-7 w-7 px-0"
                            disabled={reorderingCategory || deletingCategory || index === 0}
                            aria-label={t('clubdesk.priceList.moveCategoryUp', {
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
                            aria-label={t('clubdesk.priceList.moveCategoryDown', {
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
                            aria-label={t('clubdesk.priceList.removeCategory', {
                              name: entry.name,
                            })}
                            onClick={() => handleRequestDeleteCategory(entry.name)}
                            disabled={deletingCategory || reorderingCategory}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder={t('clubdesk.priceList.addCategoryPlaceholder')}
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
                    {t('clubdesk.priceList.addCategory')}
                  </Button>
                </div>
              </DetailSection>
            </Card>

            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('clubdesk.priceList.itemsCard')}
                icon={Tags}
                iconPlugin="clubdesk"
                className="p-6"
              >
                {getFieldError('items') ? (
                  <p className="mb-3 text-sm text-destructive">{getFieldError('items')?.message}</p>
                ) : null}

                {formData.items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      {t('clubdesk.priceList.noItemsYet')}
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      icon={Plus}
                      className="mt-3 h-9 px-3 text-xs"
                      onClick={addItem}
                    >
                      {t('clubdesk.priceList.addItem')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.items.map((item, index) => (
                      <div
                        key={`item-${index}`}
                        className="rounded-lg border border-border/60 bg-muted/20 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {t('clubdesk.priceList.itemNumber', { number: index + 1 })}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              icon={ArrowUp}
                              className="h-9 w-9 px-0"
                              aria-label={t('clubdesk.priceList.moveItemUp')}
                              onClick={() => moveItem(index, -1)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              icon={ArrowDown}
                              className="h-9 w-9 px-0"
                              aria-label={t('clubdesk.priceList.moveItemDown')}
                              onClick={() => moveItem(index, 1)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              icon={Copy}
                              className="h-9 w-9 px-0 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
                              aria-label={t('clubdesk.priceList.copyItem')}
                              onClick={() => copyItem(index)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              className="h-9 w-9 px-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                              aria-label={t('clubdesk.priceList.removeItem')}
                              onClick={() => removeItem(index)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Input
                            value={item.title}
                            onChange={(e) => updateItem(index, { title: e.target.value })}
                            placeholder={t('clubdesk.priceList.itemTitlePlaceholder')}
                            className={cn(
                              'h-9',
                              getFieldError(`items.${index}.title`) && 'border-destructive',
                            )}
                          />
                          <Textarea
                            value={item.description ?? ''}
                            onChange={(e) => {
                              const html = e.target.value;
                              updateItem(index, {
                                description: isEmptyRichText(html) ? null : html,
                              });
                            }}
                            rows={2}
                            placeholder={t('clubdesk.priceList.itemDescriptionPlaceholder')}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">{t('clubdesk.priceList.price')}</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.price}
                                onChange={(e) =>
                                  updateItem(index, { price: Number(e.target.value) || 0 })
                                }
                                className="h-9"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">{t('clubdesk.priceList.category')}</Label>
                              <Select
                                value={item.category?.trim() ? item.category : '__none__'}
                                onValueChange={(value) =>
                                  updateItem(
                                    index,
                                    value === '__none__' ? { category: null } : { category: value },
                                  )
                                }
                              >
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue
                                    placeholder={t('clubdesk.priceList.categoryPlaceholder')}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">
                                    {t('clubdesk.priceList.categoryNone')}
                                  </SelectItem>
                                  {categoryOptions.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                      {cat}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                      className="h-9 px-3 text-xs"
                      onClick={addItem}
                    >
                      {t('clubdesk.priceList.addItem')}
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
        message={priceList ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
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
            <AlertDialogTitle>
              {t('clubdesk.priceList.deleteCategoryTitle', {
                name: categoryPendingDelete || '',
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('clubdesk.priceList.deleteCategoryMovePrompt', {
                count: categoryPendingDelete ? countItemsInCategory(categoryPendingDelete) : 0,
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
            <Label htmlFor="price-list-move-category" className="text-xs">
              {t('clubdesk.priceList.moveItemsToCategory')}
            </Label>
            <Select value={moveToCategory} onValueChange={setMoveToCategory}>
              <SelectTrigger id="price-list-move-category" className="mt-1 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__uncategorized__">
                  {t('clubdesk.priceList.uncategorized')}
                </SelectItem>
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
                {deletingCategory
                  ? t('common.saving')
                  : t('clubdesk.priceList.deleteCategoryConfirm')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
