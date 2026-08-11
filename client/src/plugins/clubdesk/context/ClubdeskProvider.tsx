import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginDuplicate } from '@/core/hooks/usePluginDuplicate';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { CLUBDESK_SUBPAGE_SET } from '@/core/routing/clubdeskRoutes';
import { buildDeleteMessage } from '@/core/utils/deleteUtils';
import { buildSlug, resolveSlug, slugify } from '@/core/utils/slugUtils';

import { clubdeskApi } from '../api/clubdeskApi';
import type {
  Clubdesk,
  ClubdeskCategory,
  ClubdeskPayload,
  PublicationStatus,
  ValidationError,
} from '../types/clubdesk';
import type {
  ClubdeskPriceList,
  ClubdeskPriceListItemCategory,
  ClubdeskPriceListPayload,
} from '../types/priceList';
import { copyStepAt, reorderSteps } from '../utils/clubdeskStepOps';
import { hasDuplicateClubdeskTitle } from '../utils/clubdeskTitleDuplicate';
import {
  groupItemsByCategory,
  reorderItems,
  renumberWithinCategories,
} from '../utils/priceListItemOps';

import {
  ClubdeskContext,
  type ClubdeskActiveDomain,
  type ClubdeskContentView,
  type ClubdeskContextType,
  type ClubdeskSettingsTab,
} from './ClubdeskContext';

interface ClubdeskProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

function toPayload(clubdesk: Clubdesk, overrides?: Partial<ClubdeskPayload>): ClubdeskPayload {
  return {
    title: clubdesk.title,
    slug: clubdesk.slug,
    description: clubdesk.description,
    featuredImageUrl: clubdesk.featuredImageUrl,
    category: clubdesk.category,
    publicationStatus: clubdesk.publicationStatus,
    featured: clubdesk.featured === true,
    steps: (clubdesk.steps || []).map((step, index) => ({
      title: step.title,
      description: step.description ?? null,
      sequenceOrder: step.sequenceOrder ?? index + 1,
      imageUrl: step.imageUrl ?? null,
    })),
    ...overrides,
  };
}

function toPriceListPayload(
  priceList: ClubdeskPriceList,
  overrides?: Partial<ClubdeskPriceListPayload>,
): ClubdeskPriceListPayload {
  return {
    title: priceList.title,
    slug: priceList.slug,
    description: priceList.description,
    featuredImageUrl: priceList.featuredImageUrl,
    publicationStatus: priceList.publicationStatus,
    featured: priceList.featured === true,
    currency: priceList.currency || 'SEK',
    items: (priceList.items || []).map((item, index) => ({
      title: item.title,
      description: item.description ?? null,
      price: Number(item.price) || 0,
      category: item.category ?? null,
      sequenceOrder: item.sequenceOrder ?? index + 1,
    })),
    ...overrides,
  };
}

function hasDuplicatePriceListTitle(
  lists: ClubdeskPriceList[],
  title: string,
  excludeId?: string | null,
): boolean {
  const needle = title.trim().toLowerCase();
  if (!needle) {
    return false;
  }
  return lists.some(
    (row) =>
      String(row.id) !== String(excludeId ?? '') &&
      (row.title || '').trim().toLowerCase() === needle,
  );
}

export function ClubdeskProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: ClubdeskProviderProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/clubdesk');
  const { navigateToItem: navigateToPriceListItem, navigateToBase: navigateToPriceListBase } =
    useItemUrl('/clubdesk/price-list');

  const [isClubdeskPanelOpen, setIsClubdeskPanelOpen] = useState(false);
  const [currentClubdesk, setCurrentClubdesk] = useState<Clubdesk | null>(null);
  const [currentPriceList, setCurrentPriceList] = useState<ClubdeskPriceList | null>(null);
  const [activeDomain, setActiveDomain] = useState<ClubdeskActiveDomain>('guides');
  const [panelMode, setPanelMode] = useState<ClubdeskContextType['panelMode']>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<ValidationError>();
  const [clubdesk, setClubdesks] = useState<Clubdesk[]>([]);
  const [categories, setCategories] = useState<ClubdeskCategory[]>([]);
  const [priceLists, setPriceLists] = useState<ClubdeskPriceList[]>([]);
  const [priceListCategories, setPriceListCategories] = useState<ClubdeskPriceListItemCategory[]>(
    [],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [clubdeskContentView, setClubdesksContentView] = useState<ClubdeskContentView>('list');
  const [clubdeskSettingsTab, setClubdesksSettingsTab] = useState<ClubdeskSettingsTab>('view');
  const [recentlyDuplicatedClubdeskId, setRecentlyDuplicatedClubdeskId] = useState<string | null>(
    null,
  );
  const [recentlyDuplicatedPriceListId, setRecentlyDuplicatedPriceListId] = useState<string | null>(
    null,
  );

  const {
    selectedIds: selectedClubdeskIds,
    toggleSelection: toggleClubdeskSelectedCore,
    selectAll: selectAllClubdesksCore,
    mergeIntoSelection: mergeIntoClubdeskSelectionCore,
    clearSelection: clearClubdeskSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  const {
    selectedIds: selectedPriceListIds,
    toggleSelection: togglePriceListSelectedCore,
    selectAll: selectAllPriceListsCore,
    mergeIntoSelection: mergeIntoPriceListSelectionCore,
    clearSelection: clearPriceListSelectionCore,
    isSelected: isPriceListSelected,
    selectedCount: priceListSelectedCount,
  } = useBulkSelection();

  const closeClubdeskPanel = useCallback(() => {
    setIsClubdeskPanelOpen(false);
    setCurrentClubdesk(null);
    setCurrentPriceList(null);
    setPriceListCategories([]);
    setPanelMode('create');
    setValidationErrors([]);
    if (activeDomain === 'priceLists' || location.pathname.startsWith('/clubdesk/price-list')) {
      navigateToPriceListBase();
    } else {
      navigateToBase();
    }
  }, [
    activeDomain,
    location.pathname,
    navigateToBase,
    navigateToPriceListBase,
    setValidationErrors,
  ]);

  useEffect(() => {
    registerPanelCloseFunction('clubdesk', closeClubdeskPanel);
    return () => {
      unregisterPanelCloseFunction('clubdesk');
    };
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeClubdeskPanel]);

  useEffect(() => {
    if (!isAuthenticated) {
      setClubdesks([]);
      setCategories([]);
      setPriceLists([]);
      setPriceListCategories([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [rows, categoryRows, priceListRows] = await Promise.all([
          clubdeskApi.getClubdesks(),
          clubdeskApi.getCategories(),
          clubdeskApi.getPriceLists(),
        ]);
        if (!cancelled) {
          setClubdesks(rows);
          setCategories(categoryRows);
          setPriceLists(priceListRows);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          console.error('Failed to load clubdesk:', error);
          const err = error as { message?: string; error?: string };
          setValidationErrors([
            {
              field: 'general',
              message: err?.message || err?.error || 'Failed to load clubdesk',
            },
          ]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setValidationErrors]);

  const refreshCategories = useCallback(async () => {
    const categoryRows = await clubdeskApi.getCategories();
    setCategories(categoryRows);
  }, []);

  const createClubdeskCategory = useCallback(async (name: string) => {
    const created = await clubdeskApi.createCategory(name);
    setCategories((prev) => {
      if (prev.some((c) => c.name.toLowerCase() === created.name.toLowerCase())) {
        return prev;
      }
      return [...prev, created].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'sv'),
      );
    });
  }, []);

  const reorderClubdeskCategories = useCallback(
    async (orderedIds: string[]) => {
      setCategories((prev) => {
        const byId = new Map(prev.map((c) => [String(c.id), c]));
        const next = orderedIds
          .map((id, index) => {
            const row = byId.get(String(id));
            return row ? { ...row, sortOrder: index + 1 } : null;
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row));
        const used = new Set(next.map((c) => String(c.id)));
        const leftovers = prev.filter((c) => !used.has(String(c.id)));
        return [...next, ...leftovers];
      });
      try {
        const rows = await clubdeskApi.reorderCategories(orderedIds);
        setCategories(rows);
      } catch (error) {
        try {
          await refreshCategories();
        } catch {
          /* keep optimistic order */
        }
        throw error;
      }
    },
    [refreshCategories],
  );

  const deleteClubdeskCategory = useCallback(
    async (categoryId: string, options?: { moveToCategory: string | null }) => {
      const removed = categories.find((c) => String(c.id) === String(categoryId));
      const removedKey = (removed?.name || '').trim().toLowerCase();
      await clubdeskApi.deleteCategory(categoryId, options);
      setCategories((prev) => prev.filter((c) => String(c.id) !== String(categoryId)));
      if (removedKey && Object.prototype.hasOwnProperty.call(options || {}, 'moveToCategory')) {
        const moveTo = options?.moveToCategory ?? null;
        setClubdesks((prev) =>
          prev.map((row) =>
            (row.category || '').trim().toLowerCase() === removedKey
              ? { ...row, category: moveTo }
              : row,
          ),
        );
      }
    },
    [categories],
  );

  const refreshPriceListCategories = useCallback(async (priceListId: string) => {
    const rows = await clubdeskApi.getPriceListCategories(priceListId);
    setPriceListCategories(rows);
  }, []);

  const openClubdeskSettings = useCallback(
    (options?: { tab?: ClubdeskSettingsTab }) => {
      clearClubdeskSelectionCore();
      setRecentlyDuplicatedClubdeskId(null);
      setIsClubdeskPanelOpen(false);
      setCurrentClubdesk(null);
      setCurrentPriceList(null);
      setActiveDomain('guides');
      setPanelMode('create');
      setValidationErrors([]);
      setClubdesksSettingsTab(options?.tab ?? 'view');
      setClubdesksContentView('settings');
      onCloseOtherPanels();
      navigateToBase();
    },
    [clearClubdeskSelectionCore, navigateToBase, onCloseOtherPanels, setValidationErrors],
  );

  const closeClubdeskSettingsView = useCallback(() => {
    setClubdesksContentView('list');
  }, []);

  const ensureFullClubdesk = useCallback(async (item: Clubdesk): Promise<Clubdesk> => {
    if (Array.isArray(item.steps)) {
      return item;
    }
    return clubdeskApi.getClubdesk(item.id);
  }, []);

  const ensureFullPriceList = useCallback(
    async (item: ClubdeskPriceList): Promise<ClubdeskPriceList> => {
      if (Array.isArray(item.items)) {
        return item;
      }
      return clubdeskApi.getPriceList(item.id);
    },
    [],
  );

  const openClubdeskPanel = useCallback(
    (item: Clubdesk | null) => {
      clearClubdeskSelectionCore();
      setRecentlyDuplicatedClubdeskId(null);
      setClubdesksContentView('list');
      setActiveDomain('guides');
      setCurrentPriceList(null);
      setPriceListCategories([]);
      setCurrentClubdesk(item);
      setPanelMode(item ? 'edit' : 'create');
      setIsClubdeskPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      if (item) {
        navigateToItem(item, clubdesk, 'slug');
        void ensureFullClubdesk(item).then((full) => {
          setCurrentClubdesk(full);
          setClubdesks((prev) =>
            prev.map((row) => (String(row.id) === String(full.id) ? { ...row, ...full } : row)),
          );
        });
      }
    },
    [
      clearClubdeskSelectionCore,
      ensureFullClubdesk,
      clubdesk,
      navigateToItem,
      onCloseOtherPanels,
      setValidationErrors,
    ],
  );

  const openClubdeskForEdit = useCallback(
    (item: Clubdesk) => {
      clearClubdeskSelectionCore();
      setRecentlyDuplicatedClubdeskId(null);
      setClubdesksContentView('list');
      setActiveDomain('guides');
      setCurrentPriceList(null);
      setPriceListCategories([]);
      setCurrentClubdesk(item);
      setPanelMode('edit');
      setIsClubdeskPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(item, clubdesk, 'slug');
      void ensureFullClubdesk(item).then((full) => {
        setCurrentClubdesk(full);
        setClubdesks((prev) =>
          prev.map((row) => (String(row.id) === String(full.id) ? { ...row, ...full } : row)),
        );
      });
    },
    [
      clearClubdeskSelectionCore,
      ensureFullClubdesk,
      clubdesk,
      navigateToItem,
      onCloseOtherPanels,
      setValidationErrors,
    ],
  );

  const openClubdeskForViewRef = useRef<(item: Clubdesk) => void>(() => {});
  const openClubdeskForView = useCallback(
    (item: Clubdesk) => {
      if (!window.location.pathname.startsWith('/clubdesk')) {
        navigate(`/clubdesk/${buildSlug(item, clubdesk, 'slug')}`);
        return;
      }
      setRecentlyDuplicatedClubdeskId(null);
      setClubdesksContentView('list');
      setActiveDomain('guides');
      setCurrentPriceList(null);
      setPriceListCategories([]);
      setCurrentClubdesk(item);
      setPanelMode('view');
      setIsClubdeskPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(item, clubdesk, 'slug');
      void ensureFullClubdesk(item).then((full) => {
        setCurrentClubdesk(full);
        setClubdesks((prev) =>
          prev.map((row) => (String(row.id) === String(full.id) ? { ...row, ...full } : row)),
        );
      });
    },
    [
      ensureFullClubdesk,
      clubdesk,
      navigate,
      navigateToItem,
      onCloseOtherPanels,
      setValidationErrors,
    ],
  );
  useEffect(() => {
    openClubdeskForViewRef.current = openClubdeskForView;
  }, [openClubdeskForView]);

  const openPriceListPanel = useCallback(
    (priceList: ClubdeskPriceList | null) => {
      clearPriceListSelectionCore();
      setRecentlyDuplicatedPriceListId(null);
      setClubdesksContentView('list');
      setActiveDomain('priceLists');
      setCurrentClubdesk(null);
      setCurrentPriceList(priceList);
      setPanelMode(priceList ? 'edit' : 'create');
      setIsClubdeskPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      if (priceList) {
        navigateToPriceListItem(priceList, priceLists, 'slug');
        void ensureFullPriceList(priceList).then(async (full) => {
          setCurrentPriceList(full);
          setPriceLists((prev) =>
            prev.map((row) => (String(row.id) === String(full.id) ? { ...row, ...full } : row)),
          );
          try {
            await refreshPriceListCategories(full.id);
          } catch {
            setPriceListCategories([]);
          }
        });
      } else {
        setPriceListCategories([]);
      }
    },
    [
      clearPriceListSelectionCore,
      ensureFullPriceList,
      navigateToPriceListItem,
      onCloseOtherPanels,
      priceLists,
      refreshPriceListCategories,
      setValidationErrors,
    ],
  );

  const openPriceListForEdit = useCallback(
    (priceList: ClubdeskPriceList) => {
      clearPriceListSelectionCore();
      setRecentlyDuplicatedPriceListId(null);
      setClubdesksContentView('list');
      setActiveDomain('priceLists');
      setCurrentClubdesk(null);
      setCurrentPriceList(priceList);
      setPanelMode('edit');
      setIsClubdeskPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToPriceListItem(priceList, priceLists, 'slug');
      void ensureFullPriceList(priceList).then(async (full) => {
        setCurrentPriceList(full);
        setPriceLists((prev) =>
          prev.map((row) => (String(row.id) === String(full.id) ? { ...row, ...full } : row)),
        );
        try {
          await refreshPriceListCategories(full.id);
        } catch {
          setPriceListCategories([]);
        }
      });
    },
    [
      clearPriceListSelectionCore,
      ensureFullPriceList,
      navigateToPriceListItem,
      onCloseOtherPanels,
      priceLists,
      refreshPriceListCategories,
      setValidationErrors,
    ],
  );

  const openPriceListForViewRef = useRef<(item: ClubdeskPriceList) => void>(() => {});
  const openPriceListForView = useCallback(
    (priceList: ClubdeskPriceList) => {
      if (!window.location.pathname.startsWith('/clubdesk')) {
        navigate(`/clubdesk/price-list/${buildSlug(priceList, priceLists, 'slug')}`);
        return;
      }
      setRecentlyDuplicatedPriceListId(null);
      setClubdesksContentView('list');
      setActiveDomain('priceLists');
      setCurrentClubdesk(null);
      setCurrentPriceList(priceList);
      setPanelMode('view');
      setIsClubdeskPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToPriceListItem(priceList, priceLists, 'slug');
      void ensureFullPriceList(priceList).then(async (full) => {
        setCurrentPriceList(full);
        setPriceLists((prev) =>
          prev.map((row) => (String(row.id) === String(full.id) ? { ...row, ...full } : row)),
        );
        try {
          await refreshPriceListCategories(full.id);
        } catch {
          setPriceListCategories([]);
        }
      });
    },
    [
      ensureFullPriceList,
      navigate,
      navigateToPriceListItem,
      onCloseOtherPanels,
      priceLists,
      refreshPriceListCategories,
      setValidationErrors,
    ],
  );
  useEffect(() => {
    openPriceListForViewRef.current = openPriceListForView;
  }, [openPriceListForView]);

  const deepLinkPathSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'clubdesk') {
      return;
    }

    const pathKey = location.pathname;
    if (deepLinkPathSyncedRef.current === pathKey) {
      return;
    }

    // /clubdesk/price-list/:slug
    if (segments[1] === 'price-list') {
      if (priceLists.length === 0) {
        return;
      }
      const slug = segments[2] ?? '';
      deepLinkPathSyncedRef.current = pathKey;
      if (!slug) {
        return;
      }
      const item = resolveSlug(slug, priceLists, 'slug');
      if (item) {
        openPriceListForViewRef.current(item as ClubdeskPriceList);
      }
      return;
    }

    // /clubdesk/:guideSlug — skip named subpages
    if (clubdesk.length === 0) {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug || CLUBDESK_SUBPAGE_SET.has(slug)) {
      deepLinkPathSyncedRef.current = pathKey;
      return;
    }
    const item = resolveSlug(slug, clubdesk, 'slug');
    deepLinkPathSyncedRef.current = pathKey;
    if (item) {
      openClubdeskForViewRef.current(item as Clubdesk);
    }
  }, [location.pathname, clubdesk, priceLists]);

  const guideNav = usePluginNavigation(clubdesk, currentClubdesk, openClubdeskForView);
  const priceListNav = usePluginNavigation(priceLists, currentPriceList, openPriceListForView);

  const nav =
    activeDomain === 'priceLists' || location.pathname.startsWith('/clubdesk/price-list')
      ? priceListNav
      : guideNav;

  const validate = useCallback(
    (data: ClubdeskPayload, excludeId?: string | null): ValidationError[] => {
      const errors: ValidationError[] = [];
      if (!data.title?.trim()) {
        errors.push({ field: 'title', message: t('clubdesk.titleRequired') });
      } else if (hasDuplicateClubdeskTitle(clubdesk, data.title, excludeId)) {
        errors.push({ field: 'title', message: t('clubdesk.titleDuplicate') });
      }
      if (
        data.slug != null &&
        data.slug.trim() &&
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug.trim())
      ) {
        errors.push({ field: 'slug', message: t('clubdesk.slugInvalid') });
      }
      if (data.publicationStatus === 'published' && (!data.steps || data.steps.length === 0)) {
        errors.push({ field: 'steps', message: t('clubdesk.publishNeedsSteps') });
      }
      data.steps?.forEach((step, index) => {
        if (!step.title?.trim()) {
          errors.push({
            field: `steps.${index}.title`,
            message: t('clubdesk.stepTitleRequired', { number: index + 1 }),
          });
        }
      });
      return errors;
    },
    [clubdesk, t],
  );

  const validatePriceList = useCallback(
    (data: ClubdeskPriceListPayload, excludeId?: string | null): ValidationError[] => {
      const errors: ValidationError[] = [];
      if (!data.title?.trim()) {
        errors.push({ field: 'title', message: t('clubdesk.priceList.titleRequired') });
      } else if (hasDuplicatePriceListTitle(priceLists, data.title, excludeId)) {
        errors.push({ field: 'title', message: t('clubdesk.priceList.titleDuplicate') });
      }
      if (
        data.slug != null &&
        data.slug.trim() &&
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug.trim())
      ) {
        errors.push({ field: 'slug', message: t('clubdesk.priceList.slugInvalid') });
      }
      if (!data.currency?.trim()) {
        errors.push({ field: 'currency', message: t('clubdesk.priceList.currencyRequired') });
      }
      if (data.publicationStatus === 'published' && (!data.items || data.items.length === 0)) {
        errors.push({ field: 'items', message: t('clubdesk.priceList.publishNeedsItems') });
      }
      data.items?.forEach((item, index) => {
        if (!item.title?.trim()) {
          errors.push({
            field: `items.${index}.title`,
            message: t('clubdesk.priceList.itemTitleRequired', { number: index + 1 }),
          });
        }
      });
      return errors;
    },
    [priceLists, t],
  );

  const saveClubdesk = useCallback(
    async (raw: ClubdeskPayload): Promise<boolean> => {
      const slug =
        raw.slug?.trim() || slugify(raw.title.trim()) || `clubdesk-${Date.now().toString(36)}`;
      const payload: ClubdeskPayload = {
        title: raw.title.trim(),
        slug,
        description: raw.description?.trim() ? raw.description.trim() : null,
        featuredImageUrl: raw.featuredImageUrl?.trim() ? raw.featuredImageUrl.trim() : null,
        category: raw.category?.trim() ? raw.category.trim() : null,
        publicationStatus: raw.publicationStatus === 'published' ? 'published' : 'draft',
        featured: raw.featured === true,
        steps: (raw.steps || []).map((step, index) => {
          const rawDesc = (step.description ?? '').trim();
          const description = rawDesc && rawDesc.replace(/<[^>]*>/g, '').trim() ? rawDesc : null;
          return {
            title: step.title.trim(),
            description,
            sequenceOrder: index + 1,
            imageUrl: step.imageUrl?.trim() ? step.imageUrl.trim() : null,
          };
        }),
      };

      const errors = validate(payload, currentClubdesk?.id);
      setValidationErrors(errors);
      if (errors.some((e) => !e.message.includes('Warning'))) {
        return false;
      }

      try {
        setIsSaving(true);
        if (currentClubdesk) {
          const saved = await clubdeskApi.updateClubdesk(currentClubdesk.id, payload);
          setClubdesks((prev) =>
            prev.map((row) =>
              String(row.id) === String(currentClubdesk.id)
                ? { ...saved, stepCount: saved.steps?.length ?? saved.stepCount }
                : row,
            ),
          );
          setCurrentClubdesk(saved);
          setPanelMode('view');
        } else {
          const saved = await clubdeskApi.createClubdesk(payload);
          setClubdesks((prev) => [
            { ...saved, stepCount: saved.steps?.length ?? saved.stepCount ?? 0 },
            ...prev,
          ]);
          setCurrentClubdesk(saved);
          setPanelMode('view');
          setIsClubdeskPanelOpen(true);
          navigateToItem(saved, [saved, ...clubdesk], 'slug');
        }
        clearValidationErrors();
        return true;
      } catch (err) {
        const error = err as { errors?: ValidationError[]; message?: string; error?: string };
        console.error('Failed to save clubdesk:', err);
        if (Array.isArray(error.errors) && error.errors.length > 0) {
          setValidationErrors(error.errors);
        } else {
          setValidationErrors([
            {
              field: 'general',
              message: error?.message || error?.error || t('clubdesk.saveFailed'),
            },
          ]);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      clearValidationErrors,
      currentClubdesk,
      clubdesk,
      navigateToItem,
      setValidationErrors,
      t,
      validate,
    ],
  );

  const savePriceList = useCallback(
    async (
      raw: ClubdeskPriceListPayload,
      options?: { categoryNames?: string[] },
    ): Promise<boolean> => {
      const slug =
        raw.slug?.trim() || slugify(raw.title.trim()) || `price-list-${Date.now().toString(36)}`;
      const payload: ClubdeskPriceListPayload = {
        title: raw.title.trim(),
        slug,
        description: raw.description?.trim() ? raw.description.trim() : null,
        featuredImageUrl: null,
        publicationStatus: raw.publicationStatus === 'published' ? 'published' : 'draft',
        featured: raw.featured === true,
        currency: (raw.currency || 'SEK').trim() || 'SEK',
        items: renumberWithinCategories(
          (raw.items || []).map((item, index) => {
            const rawDesc = (item.description ?? '').trim();
            const description = rawDesc && rawDesc.replace(/<[^>]*>/g, '').trim() ? rawDesc : null;
            return {
              title: item.title.trim(),
              description,
              price: Number(item.price) || 0,
              category: item.category?.trim() ? item.category.trim() : null,
              sequenceOrder: item.sequenceOrder ?? index + 1,
            };
          }),
        ),
      };

      const errors = validatePriceList(payload, currentPriceList?.id);
      setValidationErrors(errors);
      if (errors.some((e) => !e.message.includes('Warning'))) {
        return false;
      }

      try {
        setIsSaving(true);
        setActiveDomain('priceLists');
        if (currentPriceList) {
          const saved = await clubdeskApi.updatePriceList(currentPriceList.id, payload);
          setPriceLists((prev) =>
            prev.map((row) =>
              String(row.id) === String(currentPriceList.id)
                ? { ...saved, itemCount: saved.items?.length ?? saved.itemCount }
                : row,
            ),
          );
          setCurrentPriceList(saved);
          setPanelMode('view');
          try {
            await refreshPriceListCategories(saved.id);
          } catch {
            /* keep existing categories */
          }
        } else {
          const saved = await clubdeskApi.createPriceList(payload);
          setPriceLists((prev) => [
            { ...saved, itemCount: saved.items?.length ?? saved.itemCount ?? 0 },
            ...prev,
          ]);
          setCurrentPriceList(saved);
          setPanelMode('view');
          setIsClubdeskPanelOpen(true);
          navigateToPriceListItem(saved, [saved, ...priceLists], 'slug');
          // Create categories in form catalog order, then any item category names.
          const orderedNames = [
            ...(options?.categoryNames || []).map((n) => n.trim()).filter(Boolean),
            ...(payload.items || []).map((item) => (item.category || '').trim()).filter(Boolean),
          ];
          const names = Array.from(new Set(orderedNames));
          for (const name of names) {
            try {
              await clubdeskApi.createPriceListCategory(saved.id, name);
            } catch {
              /* ignore duplicates */
            }
          }
          try {
            await refreshPriceListCategories(saved.id);
          } catch {
            setPriceListCategories([]);
          }
        }
        clearValidationErrors();
        return true;
      } catch (err) {
        const error = err as { errors?: ValidationError[]; message?: string; error?: string };
        console.error('Failed to save price list:', err);
        const mapMsg = (message: string) =>
          /duplicate sequenceorder/i.test(message)
            ? t('clubdesk.priceList.duplicateItemOrder')
            : message;
        if (Array.isArray(error.errors) && error.errors.length > 0) {
          setValidationErrors(
            error.errors.map((e) => ({
              ...e,
              field: /duplicate sequenceorder/i.test(e.message) ? 'items' : e.field,
              message: mapMsg(e.message),
            })),
          );
        } else {
          const technical = error?.message || error?.error || '';
          setValidationErrors([
            {
              field: 'items',
              message: mapMsg(technical) || t('clubdesk.priceList.saveFailed'),
            },
          ]);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      clearValidationErrors,
      currentPriceList,
      navigateToPriceListItem,
      priceLists,
      refreshPriceListCategories,
      setValidationErrors,
      t,
      validatePriceList,
    ],
  );

  const deleteClubdesk = useCallback(
    async (id: string) => {
      try {
        await clubdeskApi.deleteClubdesk(id);
        setClubdesks((prev) => prev.filter((row) => String(row.id) !== String(id)));
        if (isSelected(id)) {
          toggleClubdeskSelectedCore(id);
        }
        if (currentClubdesk && String(currentClubdesk.id) === String(id)) {
          closeClubdeskPanel();
        }
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('clubdesk.deleteFailed'),
          },
        ]);
      }
    },
    [
      closeClubdeskPanel,
      currentClubdesk,
      isSelected,
      setValidationErrors,
      t,
      toggleClubdeskSelectedCore,
    ],
  );

  const deleteClubdesks = useCallback(
    async (ids: string[]) => {
      const uniqueIds = Array.from(new Set((ids || []).map(String))).filter(Boolean);
      if (!uniqueIds.length) {
        return;
      }
      try {
        try {
          await clubdeskApi.deleteClubdesksBatch(uniqueIds);
        } catch {
          await bulkApi.bulkDelete('clubdesk', uniqueIds);
        }
        setClubdesks((prev) => prev.filter((row) => !uniqueIds.includes(String(row.id))));
        clearClubdeskSelectionCore();
        if (currentClubdesk && uniqueIds.includes(String(currentClubdesk.id))) {
          closeClubdeskPanel();
        }
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        console.error('Bulk delete failed:', error);
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('clubdesk.deleteFailed'),
          },
        ]);
      }
    },
    [clearClubdeskSelectionCore, closeClubdeskPanel, currentClubdesk, setValidationErrors, t],
  );

  const deletePriceList = useCallback(
    async (id: string) => {
      try {
        await clubdeskApi.deletePriceList(id);
        setPriceLists((prev) => prev.filter((row) => String(row.id) !== String(id)));
        if (isPriceListSelected(id)) {
          togglePriceListSelectedCore(id);
        }
        if (currentPriceList && String(currentPriceList.id) === String(id)) {
          closeClubdeskPanel();
        }
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('clubdesk.priceList.deleteFailed'),
          },
        ]);
      }
    },
    [
      closeClubdeskPanel,
      currentPriceList,
      isPriceListSelected,
      setValidationErrors,
      t,
      togglePriceListSelectedCore,
    ],
  );

  const deletePriceLists = useCallback(
    async (ids: string[]) => {
      const uniqueIds = Array.from(new Set((ids || []).map(String))).filter(Boolean);
      if (!uniqueIds.length) {
        return;
      }
      try {
        await clubdeskApi.deletePriceListsBatch(uniqueIds);
        setPriceLists((prev) => prev.filter((row) => !uniqueIds.includes(String(row.id))));
        clearPriceListSelectionCore();
        if (currentPriceList && uniqueIds.includes(String(currentPriceList.id))) {
          closeClubdeskPanel();
        }
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        console.error('Bulk delete price lists failed:', error);
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('clubdesk.priceList.deleteFailed'),
          },
        ]);
      }
    },
    [clearPriceListSelectionCore, closeClubdeskPanel, currentPriceList, setValidationErrors, t],
  );

  const updateClubdeskPublicationStatus = useCallback(
    async (clubdesk: Clubdesk, status: PublicationStatus) => {
      try {
        const full = await ensureFullClubdesk(clubdesk);
        if (status === 'published' && (!full.steps || full.steps.length === 0)) {
          setValidationErrors([{ field: 'steps', message: t('clubdesk.publishNeedsSteps') }]);
          return;
        }
        const saved = await clubdeskApi.updateClubdesk(
          full.id,
          toPayload(full, { publicationStatus: status }),
        );
        setClubdesks((prev) =>
          prev.map((row) =>
            String(row.id) === String(saved.id)
              ? { ...row, ...saved, stepCount: saved.steps?.length ?? saved.stepCount }
              : row,
          ),
        );
        if (currentClubdesk && String(currentClubdesk.id) === String(saved.id)) {
          setCurrentClubdesk(saved);
        }
        clearValidationErrors();
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('clubdesk.saveFailed'),
          },
        ]);
      }
    },
    [clearValidationErrors, currentClubdesk, ensureFullClubdesk, setValidationErrors, t],
  );

  const updatePriceListPublicationStatus = useCallback(
    async (priceList: ClubdeskPriceList, status: PublicationStatus) => {
      try {
        const full = await ensureFullPriceList(priceList);
        if (status === 'published' && (!full.items || full.items.length === 0)) {
          setValidationErrors([
            { field: 'items', message: t('clubdesk.priceList.publishNeedsItems') },
          ]);
          return;
        }
        const saved = await clubdeskApi.updatePriceList(
          full.id,
          toPriceListPayload(full, { publicationStatus: status }),
        );
        setPriceLists((prev) =>
          prev.map((row) =>
            String(row.id) === String(saved.id)
              ? { ...row, ...saved, itemCount: saved.items?.length ?? saved.itemCount }
              : row,
          ),
        );
        if (currentPriceList && String(currentPriceList.id) === String(saved.id)) {
          setCurrentPriceList(saved);
        }
        clearValidationErrors();
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('clubdesk.priceList.saveFailed'),
          },
        ]);
      }
    },
    [clearValidationErrors, currentPriceList, ensureFullPriceList, setValidationErrors, t],
  );

  const updateClubdeskFeatured = useCallback(
    async (clubdesk: Clubdesk, featured: boolean) => {
      try {
        const full = await ensureFullClubdesk(clubdesk);
        const saved = await clubdeskApi.updateClubdesk(
          full.id,
          toPayload(full, { featured: featured === true }),
        );
        setClubdesks((prev) =>
          prev.map((row) =>
            String(row.id) === String(saved.id)
              ? { ...row, ...saved, stepCount: saved.steps?.length ?? saved.stepCount }
              : row,
          ),
        );
        if (currentClubdesk && String(currentClubdesk.id) === String(saved.id)) {
          setCurrentClubdesk(saved);
        }
        clearValidationErrors();
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('clubdesk.saveFailed'),
          },
        ]);
      }
    },
    [clearValidationErrors, currentClubdesk, ensureFullClubdesk, setValidationErrors, t],
  );

  const updatePriceListFeatured = useCallback(
    async (priceList: ClubdeskPriceList, featured: boolean) => {
      try {
        const full = await ensureFullPriceList(priceList);
        const saved = await clubdeskApi.updatePriceList(
          full.id,
          toPriceListPayload(full, { featured: featured === true }),
        );
        setPriceLists((prev) =>
          prev.map((row) =>
            String(row.id) === String(saved.id)
              ? { ...row, ...saved, itemCount: saved.items?.length ?? saved.itemCount }
              : row,
          ),
        );
        if (currentPriceList && String(currentPriceList.id) === String(saved.id)) {
          setCurrentPriceList(saved);
        }
        clearValidationErrors();
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('clubdesk.priceList.saveFailed'),
          },
        ]);
      }
    },
    [clearValidationErrors, currentPriceList, ensureFullPriceList, setValidationErrors, t],
  );

  const reorderClubdeskSteps = useCallback(
    async (clubdesk: Clubdesk, fromIndex: number, direction: -1 | 1) => {
      const reordered = reorderSteps(clubdesk.steps || [], fromIndex, direction);
      if (!reordered) {
        return;
      }

      try {
        setIsSaving(true);
        const saved = await clubdeskApi.updateClubdesk(
          clubdesk.id,
          toPayload({ ...clubdesk, steps: reordered }),
        );
        setClubdesks((prev) =>
          prev.map((row) =>
            String(row.id) === String(saved.id)
              ? { ...row, ...saved, stepCount: saved.steps?.length ?? saved.stepCount }
              : row,
          ),
        );
        if (currentClubdesk && String(currentClubdesk.id) === String(saved.id)) {
          setCurrentClubdesk(saved);
        }
        clearValidationErrors();
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('clubdesk.saveFailed'),
          },
        ]);
      } finally {
        setIsSaving(false);
      }
    },
    [clearValidationErrors, currentClubdesk, setValidationErrors, t],
  );

  const copyClubdeskStep = useCallback(
    async (clubdesk: Clubdesk, index: number) => {
      const nextSteps = copyStepAt(clubdesk.steps || [], index);
      if (!nextSteps) {
        return;
      }

      try {
        setIsSaving(true);
        const saved = await clubdeskApi.updateClubdesk(
          clubdesk.id,
          toPayload({ ...clubdesk, steps: nextSteps }),
        );
        setClubdesks((prev) =>
          prev.map((row) =>
            String(row.id) === String(saved.id)
              ? { ...row, ...saved, stepCount: saved.steps?.length ?? saved.stepCount }
              : row,
          ),
        );
        if (currentClubdesk && String(currentClubdesk.id) === String(saved.id)) {
          setCurrentClubdesk(saved);
        }
        clearValidationErrors();
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('clubdesk.saveFailed'),
          },
        ]);
      } finally {
        setIsSaving(false);
      }
    },
    [clearValidationErrors, currentClubdesk, setValidationErrors, t],
  );

  const reorderClubdesksInCategory = useCallback(
    async (category: string | null, orderedIds: string[]) => {
      try {
        setIsSaving(true);
        const rows = await clubdeskApi.reorderClubdesks(category, orderedIds);
        setClubdesks(rows);
        clearValidationErrors();
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('clubdesk.saveFailed'),
          },
        ]);
      } finally {
        setIsSaving(false);
      }
    },
    [clearValidationErrors, setValidationErrors, t],
  );

  const reorderPriceListsFn = useCallback(
    async (orderedIds: string[]) => {
      try {
        setIsSaving(true);
        const rows = await clubdeskApi.reorderPriceLists(orderedIds);
        setPriceLists(rows);
        clearValidationErrors();
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('clubdesk.priceList.saveFailed'),
          },
        ]);
      } finally {
        setIsSaving(false);
      }
    },
    [clearValidationErrors, setValidationErrors, t],
  );

  const reorderPriceListItems = useCallback(
    async (
      priceList: ClubdeskPriceList,
      category: string | null,
      fromIndexInCategory: number,
      direction: -1 | 1,
    ) => {
      const items = priceList.items || [];
      const groups = groupItemsByCategory(items);
      const group = groups.find((g) => {
        const a = (g.category || '').trim().toLowerCase();
        const b = (category || '').trim().toLowerCase();
        return a === b;
      });
      if (!group) {
        return;
      }
      const globalIndexes = group.items.map((item) =>
        items.findIndex((row) => row === item || (row.id && item.id && row.id === item.id)),
      );
      const fromGlobal = globalIndexes[fromIndexInCategory];
      if (fromGlobal == null || fromGlobal < 0) {
        return;
      }
      const reordered = reorderItems(items, fromGlobal, direction);
      if (!reordered) {
        return;
      }
      const nextGroup = groupItemsByCategory(reordered).find((g) => {
        const a = (g.category || '').trim().toLowerCase();
        const b = (category || '').trim().toLowerCase();
        return a === b;
      });
      const orderedIds = (nextGroup?.items || [])
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id));
      if (orderedIds.length === 0) {
        return;
      }

      try {
        setIsSaving(true);
        const saved = await clubdeskApi.reorderPriceListItems(priceList.id, category, orderedIds);
        setPriceLists((prev) =>
          prev.map((row) =>
            String(row.id) === String(saved.id)
              ? { ...row, ...saved, itemCount: saved.items?.length ?? saved.itemCount }
              : row,
          ),
        );
        if (currentPriceList && String(currentPriceList.id) === String(saved.id)) {
          setCurrentPriceList(saved);
        }
        clearValidationErrors();
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        setValidationErrors([
          {
            field: 'general',
            message: err?.message || err?.error || t('clubdesk.priceList.saveFailed'),
          },
        ]);
      } finally {
        setIsSaving(false);
      }
    },
    [clearValidationErrors, currentPriceList, setValidationErrors, t],
  );

  const createPriceListCategory = useCallback(async (priceListId: string, name: string) => {
    const created = await clubdeskApi.createPriceListCategory(priceListId, name);
    setPriceListCategories((prev) => {
      if (prev.some((c) => c.name.toLowerCase() === created.name.toLowerCase())) {
        return prev;
      }
      return [...prev, created].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'sv'),
      );
    });
  }, []);

  const reorderPriceListCategories = useCallback(
    async (priceListId: string, orderedIds: string[]) => {
      setPriceListCategories((prev) => {
        const byId = new Map(prev.map((c) => [String(c.id), c]));
        const next = orderedIds
          .map((id, index) => {
            const row = byId.get(String(id));
            return row ? { ...row, sortOrder: index + 1 } : null;
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row));
        const used = new Set(next.map((c) => String(c.id)));
        const leftovers = prev.filter((c) => !used.has(String(c.id)));
        return [...next, ...leftovers];
      });
      try {
        const rows = await clubdeskApi.reorderPriceListCategories(priceListId, orderedIds);
        setPriceListCategories(rows);
      } catch (error) {
        try {
          await refreshPriceListCategories(priceListId);
        } catch {
          /* keep optimistic order if refresh also fails */
        }
        throw error;
      }
    },
    [refreshPriceListCategories],
  );

  const deletePriceListCategoryFn = useCallback(
    async (
      priceListId: string,
      categoryId: string,
      options?: { moveToCategory: string | null },
    ) => {
      await clubdeskApi.deletePriceListCategory(priceListId, categoryId, options);
      setPriceListCategories((prev) => prev.filter((c) => String(c.id) !== String(categoryId)));
    },
    [],
  );

  const createClubdeskDuplicate = useCallback(
    async (item: Clubdesk, newName: string): Promise<Clubdesk> => {
      const full = await ensureFullClubdesk(item);
      const nextTitle = (newName ?? '').trim() || full.title?.trim() || 'Untitled';
      return clubdeskApi.createClubdesk({
        title: nextTitle,
        slug: slugify(nextTitle) || undefined,
        description: full.description,
        featuredImageUrl: full.featuredImageUrl,
        category: full.category,
        publicationStatus: 'draft',
        featured: full.featured === true,
        steps: (full.steps || []).map((step, index) => ({
          title: step.title,
          description: step.description ?? null,
          sequenceOrder: index + 1,
          imageUrl: step.imageUrl ?? null,
        })),
      });
    },
    [ensureFullClubdesk],
  );

  const { getDuplicateConfig, executeDuplicate } = usePluginDuplicate({
    getDefaultName: (item: Clubdesk) => `Copy of ${item.title?.trim() || 'Item'}`,
    nameLabel: t('clubdesk.title'),
    confirmOnly: false,
    createDuplicate: async (item, newName) => {
      const saved = await createClubdeskDuplicate(item, newName);
      setClubdesks((prev) => [
        { ...saved, stepCount: saved.steps?.length ?? saved.stepCount ?? 0 },
        ...prev,
      ]);
      return saved;
    },
    closePanel: closeClubdeskPanel,
  });

  const createPriceListDuplicate = useCallback(
    async (item: ClubdeskPriceList, newName: string): Promise<ClubdeskPriceList> => {
      const full = await ensureFullPriceList(item);
      const nextTitle = (newName ?? '').trim() || full.title?.trim() || 'Untitled';
      return clubdeskApi.createPriceList({
        title: nextTitle,
        slug: slugify(nextTitle) || undefined,
        description: full.description,
        featuredImageUrl: full.featuredImageUrl,
        publicationStatus: 'draft',
        featured: full.featured === true,
        currency: full.currency || 'SEK',
        items: (full.items || []).map((row, index) => ({
          title: row.title,
          description: row.description ?? null,
          price: Number(row.price) || 0,
          category: row.category ?? null,
          sequenceOrder: row.sequenceOrder ?? index + 1,
        })),
      });
    },
    [ensureFullPriceList],
  );

  const {
    getDuplicateConfig: getPriceListDuplicateConfig,
    executeDuplicate: executePriceListDuplicate,
  } = usePluginDuplicate({
    getDefaultName: (item: ClubdeskPriceList) => `Copy of ${item.title?.trim() || 'Item'}`,
    nameLabel: t('clubdesk.priceList.title'),
    confirmOnly: false,
    createDuplicate: async (item, newName) => {
      const saved = await createPriceListDuplicate(item, newName);
      setPriceLists((prev) => [
        { ...saved, itemCount: saved.items?.length ?? saved.itemCount ?? 0 },
        ...prev,
      ]);
      return saved;
    },
    closePanel: closeClubdeskPanel,
  });

  const isPriceListUi =
    activeDomain === 'priceLists' || location.pathname.startsWith('/clubdesk/price-list');

  // Core chrome may call getDeleteMessage(currentClubdesk); on price-list tab that alias is a price list.
  const getDeleteMessage = (item: Clubdesk | null) =>
    buildDeleteMessage(
      t,
      isPriceListUi ? 'clubdesk.priceList' : 'clubdesk',
      item?.title || undefined,
    );

  const getPriceListDeleteMessage = (item: ClubdeskPriceList | null) =>
    buildDeleteMessage(t, 'clubdesk.priceList', item?.title || undefined);

  const value = useMemo<ClubdeskContextType>(
    () => ({
      isClubdeskPanelOpen,
      // Core panel chrome reads `currentClubdesk` + `openClubdeskFor*`. Alias price-list APIs on that tab.
      currentClubdesk: (isPriceListUi ? currentPriceList : currentClubdesk) as Clubdesk | null,
      panelMode,
      activeDomain,
      validationErrors,
      clubdesk,
      categories,
      refreshCategories,
      createClubdeskCategory,
      reorderClubdeskCategories,
      deleteClubdeskCategory,
      priceLists,
      currentPriceList,
      priceListCategories,
      refreshPriceListCategories,
      isSaving,
      clubdeskContentView,
      clubdeskSettingsTab,
      openClubdeskSettings,
      closeClubdeskSettingsView,
      openClubdeskPanel: isPriceListUi
        ? (openPriceListPanel as unknown as typeof openClubdeskPanel)
        : openClubdeskPanel,
      openClubdeskForEdit: isPriceListUi
        ? (openPriceListForEdit as unknown as typeof openClubdeskForEdit)
        : openClubdeskForEdit,
      openClubdeskForView: isPriceListUi
        ? (openPriceListForView as unknown as typeof openClubdeskForView)
        : openClubdeskForView,
      closeClubdeskPanel,
      saveClubdesk: isPriceListUi
        ? (savePriceList as unknown as typeof saveClubdesk)
        : saveClubdesk,
      deleteClubdesk,
      deleteClubdesks,
      updateClubdeskPublicationStatus,
      updateClubdeskFeatured,
      reorderClubdeskSteps,
      copyClubdeskStep,
      reorderClubdesksInCategory,
      openPriceListPanel,
      openPriceListForEdit,
      openPriceListForView,
      savePriceList,
      deletePriceList,
      deletePriceLists,
      updatePriceListPublicationStatus,
      updatePriceListFeatured,
      reorderPriceLists: reorderPriceListsFn,
      reorderPriceListItems,
      createPriceListCategory,
      reorderPriceListCategories,
      deletePriceListCategory: deletePriceListCategoryFn,
      getDuplicateConfig: isPriceListUi
        ? (getPriceListDuplicateConfig as unknown as typeof getDuplicateConfig)
        : getDuplicateConfig,
      executeDuplicate: isPriceListUi
        ? (executePriceListDuplicate as unknown as typeof executeDuplicate)
        : executeDuplicate,
      getPriceListDuplicateConfig,
      executePriceListDuplicate,
      clearValidationErrors,
      selectedClubdeskIds,
      toggleClubdeskSelected: toggleClubdeskSelectedCore,
      selectAllClubdesks: selectAllClubdesksCore,
      mergeIntoClubdeskSelection: mergeIntoClubdeskSelectionCore,
      clearClubdeskSelection: clearClubdeskSelectionCore,
      selectedPriceListIds,
      togglePriceListSelected: togglePriceListSelectedCore,
      selectAllPriceLists: selectAllPriceListsCore,
      mergeIntoPriceListSelection: mergeIntoPriceListSelectionCore,
      clearPriceListSelection: clearPriceListSelectionCore,
      selectedCount,
      isSelected,
      priceListSelectedCount,
      isPriceListSelected,
      getDeleteMessage,
      getPriceListDeleteMessage,
      recentlyDuplicatedClubdeskId,
      setRecentlyDuplicatedClubdeskId,
      recentlyDuplicatedPriceListId,
      setRecentlyDuplicatedPriceListId,
      navigateToPrevItem: nav.navigateToPrevItem,
      navigateToNextItem: nav.navigateToNextItem,
      hasPrevItem: nav.hasPrevItem,
      hasNextItem: nav.hasNextItem,
      currentItemIndex: nav.currentItemIndex,
      totalItems: nav.totalItems,
    }),
    [
      isClubdeskPanelOpen,
      isPriceListUi,
      currentClubdesk,
      panelMode,
      activeDomain,
      validationErrors,
      clubdesk,
      categories,
      refreshCategories,
      createClubdeskCategory,
      reorderClubdeskCategories,
      deleteClubdeskCategory,
      priceLists,
      currentPriceList,
      priceListCategories,
      refreshPriceListCategories,
      isSaving,
      clubdeskContentView,
      clubdeskSettingsTab,
      openClubdeskSettings,
      closeClubdeskSettingsView,
      openClubdeskPanel,
      openClubdeskForEdit,
      openClubdeskForView,
      closeClubdeskPanel,
      saveClubdesk,
      deleteClubdesk,
      deleteClubdesks,
      updateClubdeskPublicationStatus,
      updateClubdeskFeatured,
      reorderClubdeskSteps,
      copyClubdeskStep,
      reorderClubdesksInCategory,
      openPriceListPanel,
      openPriceListForEdit,
      openPriceListForView,
      savePriceList,
      deletePriceList,
      deletePriceLists,
      updatePriceListPublicationStatus,
      updatePriceListFeatured,
      reorderPriceListsFn,
      reorderPriceListItems,
      createPriceListCategory,
      reorderPriceListCategories,
      deletePriceListCategoryFn,
      getDuplicateConfig,
      executeDuplicate,
      getPriceListDuplicateConfig,
      executePriceListDuplicate,
      clearValidationErrors,
      selectedClubdeskIds,
      toggleClubdeskSelectedCore,
      selectAllClubdesksCore,
      mergeIntoClubdeskSelectionCore,
      clearClubdeskSelectionCore,
      selectedPriceListIds,
      togglePriceListSelectedCore,
      selectAllPriceListsCore,
      mergeIntoPriceListSelectionCore,
      clearPriceListSelectionCore,
      selectedCount,
      isSelected,
      priceListSelectedCount,
      isPriceListSelected,
      getDeleteMessage,
      getPriceListDeleteMessage,
      recentlyDuplicatedClubdeskId,
      recentlyDuplicatedPriceListId,
      nav.navigateToPrevItem,
      nav.navigateToNextItem,
      nav.hasPrevItem,
      nav.hasNextItem,
      nav.currentItemIndex,
      nav.totalItems,
      t,
    ],
  );

  return <ClubdeskContext.Provider value={value}>{children}</ClubdeskContext.Provider>;
}
