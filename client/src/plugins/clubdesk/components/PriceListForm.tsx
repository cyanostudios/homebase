import { ArrowDown, ArrowUp, Check, History, Info, Plus, Tags, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogRoundCancel, AlertDialogRoundDelete } from '@/core/ui/DialogRoundButtons';
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
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import {
  FORM_GHOST_INPUT_CLASS,
  FORM_INPUT_ERROR_CLASS,
  FORM_GHOST_TEXTAREA_CLASS,
} from '@/core/ui/formFieldStyles';
import { slugify } from '@/core/utils/slugUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useClubdesk } from '../hooks/useClubdesk';
import type { PublicationStatus } from '../types/clubdesk';
import type {
  ClubdeskPriceList,
  ClubdeskPriceListItemPayload,
  ClubdeskPriceListPayload,
} from '../types/priceList';
import {
  copyItemAt,
  newClientKey,
  renumberWithinCategories,
  reorderItems,
} from '../utils/priceListItemOps';

import { PriceListItemsEditor } from './PriceListItemsEditor';

function emptyItem(order: number): ClubdeskPriceListItemPayload {
  return {
    title: '',
    description: null,
    price: 0,
    category: null,
    sequenceOrder: order,
    clientKey: newClientKey('new'),
  };
}

function emptyPriceListFormData(): ClubdeskPriceListPayload {
  return {
    title: '',
    slug: '',
    description: null,
    featuredImageUrl: null,
    publicationStatus: 'draft',
    featured: false,
    currency: 'SEK',
    items: [],
  };
}

function formDataFromPriceList(priceList: ClubdeskPriceList | null): ClubdeskPriceListPayload {
  if (!priceList) {
    return emptyPriceListFormData();
  }
  return {
    title: priceList.title || '',
    slug: priceList.slug || '',
    description: priceList.description,
    featuredImageUrl: priceList.featuredImageUrl,
    publicationStatus: priceList.publicationStatus || 'draft',
    featured: priceList.featured === true,
    currency: priceList.currency || 'SEK',
    items: (priceList.items || []).map((item, index) => ({
      title: item.title || '',
      description: item.description ?? null,
      price: Number(item.price) || 0,
      category: item.category ?? null,
      sequenceOrder: item.sequenceOrder ?? index + 1,
      clientKey: item.id || newClientKey(`loaded-${index}`),
    })),
  };
}

type PriceListFormTab = 'information' | 'items' | 'activity';

const PRICE_LIST_FORM_TABS: PriceListFormTab[] = ['information', 'items', 'activity'];

const PRICE_LIST_FORM_EDIT_DISABLED_TABS: ReadonlySet<PriceListFormTab> = new Set(['activity']);

function parsePriceListFormTab(value: string | null): PriceListFormTab {
  if (value === 'properties') {
    return 'information';
  }
  if (value && PRICE_LIST_FORM_TABS.includes(value as PriceListFormTab)) {
    return value as PriceListFormTab;
  }
  return 'information';
}

export const PriceListForm = React.forwardRef<
  PanelFormHandle,
  { stacked?: boolean; headerTrailing?: React.ReactNode }
>(function PriceListForm({ stacked = false, headerTrailing }, ref) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parsePriceListFormTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: PriceListFormTab, replace = false) => {
      if (PRICE_LIST_FORM_EDIT_DISABLED_TABS.has(tab)) {
        return;
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'information') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!PRICE_LIST_FORM_EDIT_DISABLED_TABS.has(activeTab)) {
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('tab');
        return next;
      },
      { replace: true },
    );
  }, [activeTab, setSearchParams]);

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
  const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
    useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  /** Preserves mixed local/server category order after drag via arrows. */
  const [categoryOrderNames, setCategoryOrderNames] = useState<string[] | null>(null);
  const [categoryPendingDelete, setCategoryPendingDelete] = useState<string | null>(null);
  const [duplicatedItemIndexes, setDuplicatedItemIndexes] = useState<Set<number>>(() => new Set());
  const [moveToCategory, setMoveToCategory] = useState<string>('__uncategorized__');
  const [categoryDeleteError, setCategoryDeleteError] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);
  const [reorderingCategory, setReorderingCategory] = useState(false);
  const [formData, setFormData] = useState<ClubdeskPriceListPayload>(() =>
    formDataFromPriceList(priceList),
  );

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
    registerUnsavedChangesChecker(formKey, () => true);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [priceList, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  const resetForm = useCallback(() => {
    setFormData(emptyPriceListFormData());
    setSlugTouched(false);
    setLocalCategories([]);
    setCategoryOrderNames(null);
    setNewCategoryName('');
    markClean();
  }, [markClean]);

  useEffect(() => {
    if (priceList) {
      setFormData(formDataFromPriceList(priceList));
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
    attemptAction(() => closeClubdeskPanel(), { force: true });
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
      items: renumberWithinCategories(prev.items.filter((_, i) => i !== index)),
    }));
    setDuplicatedItemIndexes(new Set());
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
    setDuplicatedItemIndexes(new Set());
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
    setDuplicatedItemIndexes(new Set([index + 1]));
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

  const tabs = useMemo(
    () => [
      {
        id: 'information' as const,
        label: t('clubdesk.priceList.tabs.information'),
        icon: Info,
      },
      {
        id: 'items' as const,
        label: t('clubdesk.priceList.tabs.items'),
        icon: Tags,
        count: formData.items.length > 0 ? formData.items.length : null,
      },
      {
        id: 'activity' as const,
        label: t('clubdesk.priceList.tabs.activity'),
        icon: History,
      },
    ],
    [formData.items.length, t],
  );

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isDisabled = PRICE_LIST_FORM_EDIT_DISABLED_TABS.has(tab.id);
        const isActive = !isDisabled && activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            title={
              isDisabled
                ? t('clubdesk.tabUnavailableInEdit', {
                    defaultValue: 'Available in view mode only',
                  })
                : undefined
            }
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              isDisabled && 'pointer-events-none opacity-40',
            )}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {'count' in tab && tab.count != null ? (
                <>
                  {' '}
                  <span className="tabular-nums font-semibold">({tab.count})</span>
                </>
              ) : null}
            </span>
          </Button>
        );
      })}
    </div>
  );

  const formHeader = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
      <div className="px-4 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex shrink-0" aria-hidden>
            <SectionCategoryIcon icon={Tags} />
          </span>
          <div className="min-w-0 flex-1">
            <Input
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder={t('clubdesk.priceList.titlePlaceholder')}
              aria-label={t('clubdesk.priceList.title')}
              className={FORM_GHOST_INPUT_CLASS}
            />
          </div>
          {headerTrailing ? (
            <div className="flex shrink-0 items-center gap-1">{headerTrailing}</div>
          ) : null}
        </div>
        <div className="mt-4">{tabChips}</div>
      </div>
    </Card>
  );

  return (
    <>
      <div className="plugin-clubdesk">
        <DetailLayout gridClassName="grid-cols-1">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            {formHeader}

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

            {activeTab === 'information' ? (
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
                        className={cn(
                          FORM_GHOST_INPUT_CLASS,
                          getFieldError('title') && FORM_INPUT_ERROR_CLASS,
                        )}
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
                        className={cn(
                          FORM_GHOST_INPUT_CLASS,
                          getFieldError('slug') && FORM_INPUT_ERROR_CLASS,
                        )}
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
                        className={FORM_GHOST_TEXTAREA_CLASS}
                      />
                    </div>
                    <div>
                      <Label htmlFor="price-list-currency">
                        {t('clubdesk.priceList.currency')}
                      </Label>
                      <Input
                        id="price-list-currency"
                        value={formData.currency}
                        onChange={(e) => updateField('currency', e.target.value.toUpperCase())}
                        placeholder="SEK"
                        className={cn(
                          FORM_GHOST_INPUT_CLASS,
                          getFieldError('currency') && FORM_INPUT_ERROR_CLASS,
                        )}
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
                        <SelectTrigger id="price-list-status" className={FORM_GHOST_INPUT_CLASS}>
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
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          id="price-list-featured"
                          type="checkbox"
                          checked={formData.featured === true}
                          onChange={(e) => updateField('featured', e.target.checked)}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="price-list-featured" className="font-normal">
                          {t('clubdesk.featured')}
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('clubdesk.featuredHint')}</p>
                    </div>
                  </div>
                </DetailSection>
              </Card>
            ) : null}

            {activeTab === 'information' ? (
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
                      className={FORM_GHOST_INPUT_CLASS}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleAddCategory();
                        }
                      }}
                    />
                    <RoundIconLabelButton
                      type="button"
                      icon={Plus}
                      label={t('clubdesk.priceList.addCategory')}
                      variant="soft"
                      size="xs"
                      alwaysExpanded
                      onClick={() => void handleAddCategory()}
                    />
                  </div>
                </DetailSection>
              </Card>
            ) : null}

            {activeTab === 'items' ? (
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection
                  title={t('clubdesk.priceList.itemsCard')}
                  icon={Tags}
                  iconPlugin="clubdesk"
                  className="p-6"
                >
                  {getFieldError('items') ? (
                    <p className="mb-3 text-sm text-destructive">
                      {getFieldError('items')?.message}
                    </p>
                  ) : null}

                  <PriceListItemsEditor
                    items={formData.items}
                    categoryOptions={categoryOptions}
                    duplicatedIndexes={duplicatedItemIndexes}
                    getTitleError={(index) => getFieldError(`items.${index}.title`)?.message}
                    onAdd={addItem}
                    onUpdate={updateItem}
                    onDuplicate={copyItem}
                    onRemove={removeItem}
                    onMoveUp={(index) => moveItem(index, -1)}
                    onMoveDown={(index) => moveItem(index, 1)}
                  />
                </DetailSection>
              </Card>
            ) : null}

            {!stacked ? (
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
            ) : null}
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
              <SelectTrigger
                id="price-list-move-category"
                className={cn('mt-1', FORM_GHOST_INPUT_CLASS)}
              >
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
            <AlertDialogRoundCancel
              disabled={deletingCategory}
              onClick={() => {
                setCategoryPendingDelete(null);
                setMoveToCategory('__uncategorized__');
                setCategoryDeleteError(null);
              }}
            />
            <AlertDialogRoundDelete
              disabled={deletingCategory}
              label={
                deletingCategory
                  ? t('common.saving')
                  : t('clubdesk.priceList.deleteCategoryConfirm')
              }
              onClick={handleConfirmDeleteCategory}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
