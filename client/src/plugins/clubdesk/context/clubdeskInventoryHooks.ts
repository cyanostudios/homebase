import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import type { ImportResult } from '@/core/utils/importUtils';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { shouldKeepPendingInventoryItemPath } from '@/core/routing/clubdeskRoutes';
import { buildSlug, resolveSlug, slugify } from '@/core/utils/slugUtils';

import { clubdeskApi } from '../api/clubdeskApi';
import type { ValidationError } from '../types/clubdesk';
import type { ClubdeskInventoryItem, ClubdeskInventoryItemPayload } from '../types/inventory';
import { groupInventoryImportRows } from '../utils/groupInventoryImportRows';
import {
  buildInventoryImportFailureMessages,
  createEmptyInventoryImportFailureCounts,
  inventoryImportFailureTotal,
  recordInventoryApiFailure,
  recordInventoryValidationFailure,
} from '../utils/inventoryImportFailures';
import { normalizeClubdeskInventoryItemPayload } from '../utils/inventoryPayloadNormalization';
import { validateInventoryPayload } from '../utils/inventoryValidation';

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export function useClubdeskInventoryDomain(options: {
  isAuthenticated: boolean;
  navigate: NavigateFunction;
  pathname: string;
  onCloseOtherPanels: () => void;
  setIsClubdeskPanelOpen: (open: boolean) => void;
  setPanelMode: (mode: 'create' | 'edit' | 'view') => void;
  setActiveDomain: (domain: 'guides' | 'priceLists' | 'inventory') => void;
  clearGuideSelection: () => void;
  clearPriceListSelection: () => void;
  setCurrentClubdesk: (item: null) => void;
  setCurrentPriceList: (item: null) => void;
  setPriceListCategories: (rows: []) => void;
  deepLinkPathSyncedRef: React.MutableRefObject<string | null>;
  t: TFunction;
}) {
  const {
    isAuthenticated,
    navigate,
    pathname,
    onCloseOtherPanels,
    setIsClubdeskPanelOpen,
    setPanelMode,
    setActiveDomain,
    clearGuideSelection,
    clearPriceListSelection,
    setCurrentClubdesk,
    setCurrentPriceList,
    setPriceListCategories,
    deepLinkPathSyncedRef,
    t,
  } = options;

  const { navigateToItem } = useItemUrl('/clubdesk/inventory');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<ValidationError>();
  const [inventoryItems, setInventoryItems] = useState<ClubdeskInventoryItem[]>([]);
  const [currentInventoryItem, setCurrentInventoryItem] = useState<ClubdeskInventoryItem | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [recentlyDuplicatedInventoryId, setRecentlyDuplicatedInventoryId] = useState<string | null>(
    null,
  );

  /** Always land on inventory URL (navigateToItem is a no-op off /clubdesk/inventory). */
  const goToInventoryItemUrl = useCallback(
    (item: ClubdeskInventoryItem) => {
      const slug = buildSlug(item, inventoryItems, 'slug');
      const targetPath = `/clubdesk/inventory/${slug}`;
      deepLinkPathSyncedRef.current = targetPath;
      if (pathname.startsWith('/clubdesk/inventory')) {
        navigateToItem(item, inventoryItems, 'slug');
      } else {
        navigate(targetPath);
      }
    },
    [deepLinkPathSyncedRef, inventoryItems, navigate, navigateToItem, pathname],
  );

  const bulk = useBulkSelection();

  const ensureFullInventoryItem = useCallback(async (item: ClubdeskInventoryItem) => {
    const loaded = Array.isArray(item.variants);
    const count = item.variantCount ?? 0;
    if (loaded && (item.variants!.length > 0 || count === 0)) {
      return item;
    }
    return clubdeskApi.getInventoryItem(item.id);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setInventoryItems([]);
      return;
    }
    let cancelled = false;
    void clubdeskApi
      .getInventoryItems()
      .then((rows) => {
        if (!cancelled) {
          setInventoryItems(rows);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load clubdesk inventory:', error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const openInventoryPanel = useCallback(
    (item: ClubdeskInventoryItem | null) => {
      clearGuideSelection();
      clearPriceListSelection();
      setRecentlyDuplicatedInventoryId(null);
      setActiveDomain('inventory');
      setCurrentClubdesk(null);
      setCurrentPriceList(null);
      setPriceListCategories([]);
      setCurrentInventoryItem(item);
      setPanelMode(item ? 'edit' : 'create');
      setIsClubdeskPanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
      if (item) {
        goToInventoryItemUrl(item);
        void ensureFullInventoryItem(item).then((full) => {
          setCurrentInventoryItem(full);
          setInventoryItems((prev) =>
            prev.map((row) => (String(row.id) === String(full.id) ? { ...row, ...full } : row)),
          );
        });
      }
    },
    [
      clearGuideSelection,
      clearPriceListSelection,
      clearValidationErrors,
      ensureFullInventoryItem,
      goToInventoryItemUrl,
      onCloseOtherPanels,
      setActiveDomain,
      setCurrentClubdesk,
      setCurrentPriceList,
      setIsClubdeskPanelOpen,
      setPanelMode,
      setPriceListCategories,
    ],
  );

  const openInventoryForEdit = useCallback(
    (item: ClubdeskInventoryItem) => {
      clearGuideSelection();
      clearPriceListSelection();
      setRecentlyDuplicatedInventoryId(null);
      setActiveDomain('inventory');
      setCurrentClubdesk(null);
      setCurrentPriceList(null);
      setPriceListCategories([]);
      setCurrentInventoryItem(item);
      setPanelMode('edit');
      setIsClubdeskPanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
      goToInventoryItemUrl(item);
      void ensureFullInventoryItem(item).then((full) => {
        setCurrentInventoryItem(full);
        setInventoryItems((prev) =>
          prev.map((row) => (String(row.id) === String(full.id) ? { ...row, ...full } : row)),
        );
      });
    },
    [
      clearGuideSelection,
      clearPriceListSelection,
      clearValidationErrors,
      ensureFullInventoryItem,
      goToInventoryItemUrl,
      onCloseOtherPanels,
      setActiveDomain,
      setCurrentClubdesk,
      setCurrentPriceList,
      setIsClubdeskPanelOpen,
      setPanelMode,
      setPriceListCategories,
    ],
  );

  const openInventoryForViewRef = useRef<(item: ClubdeskInventoryItem) => void>(() => {});
  const openInventoryForView = useCallback(
    (item: ClubdeskInventoryItem) => {
      clearGuideSelection();
      clearPriceListSelection();
      setRecentlyDuplicatedInventoryId(null);
      setActiveDomain('inventory');
      setCurrentClubdesk(null);
      setCurrentPriceList(null);
      setPriceListCategories([]);
      setCurrentInventoryItem(item);
      setPanelMode('view');
      setIsClubdeskPanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
      goToInventoryItemUrl(item);
      void ensureFullInventoryItem(item).then((full) => {
        setCurrentInventoryItem(full);
        setInventoryItems((prev) =>
          prev.map((row) => (String(row.id) === String(full.id) ? { ...row, ...full } : row)),
        );
      });
    },
    [
      clearGuideSelection,
      clearPriceListSelection,
      clearValidationErrors,
      ensureFullInventoryItem,
      goToInventoryItemUrl,
      onCloseOtherPanels,
      setActiveDomain,
      setCurrentClubdesk,
      setCurrentPriceList,
      setIsClubdeskPanelOpen,
      setPanelMode,
      setPriceListCategories,
    ],
  );
  openInventoryForViewRef.current = openInventoryForView;

  const inventoryPanelModeRef = useRef<'create' | 'edit' | 'view'>('create');
  const currentInventoryIdRef = useRef<string | null>(null);
  inventoryPanelModeRef.current =
    currentInventoryItem &&
    inventoryItems.some((r) => String(r.id) === String(currentInventoryItem.id))
      ? (inventoryPanelModeRef.current as 'create' | 'edit' | 'view')
      : inventoryPanelModeRef.current;

  useEffect(() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] !== 'clubdesk' || segments[1] !== 'inventory') {
      return;
    }
    const pathKey = pathname;
    if (deepLinkPathSyncedRef.current === pathKey) {
      return;
    }
    if (inventoryItems.length === 0) {
      return;
    }
    const slug = segments[2] ?? '';
    if (!slug) {
      if (shouldKeepPendingInventoryItemPath(pathKey, deepLinkPathSyncedRef.current)) {
        return;
      }
      deepLinkPathSyncedRef.current = pathKey;
      return;
    }
    deepLinkPathSyncedRef.current = pathKey;
    const item = resolveSlug(slug, inventoryItems, 'slug');
    if (!item) {
      return;
    }
    const mode = inventoryPanelModeRef.current;
    const currentId = currentInventoryIdRef.current;
    if ((mode === 'edit' || mode === 'create') && currentId && String(item.id) === currentId) {
      return;
    }
    openInventoryForViewRef.current(item as ClubdeskInventoryItem);
  }, [pathname, inventoryItems, deepLinkPathSyncedRef]);

  useEffect(() => {
    currentInventoryIdRef.current = currentInventoryItem ? String(currentInventoryItem.id) : null;
  }, [currentInventoryItem]);

  const validateInventory = useCallback(
    (data: ClubdeskInventoryItemPayload) => {
      return validateInventoryPayload(data, {
        articleNameRequired: t('clubdesk.inventory.articleNameRequired'),
        purchasePriceInvalid: t('clubdesk.inventory.purchasePriceInvalid'),
        recommendedPriceInvalid: t('clubdesk.inventory.recommendedPriceInvalid'),
        salePriceInvalid: t('clubdesk.inventory.salePriceInvalid'),
        quantityInvalid: t('clubdesk.inventory.quantityInvalid'),
      });
    },
    [t],
  );

  const saveInventoryItem = useCallback(
    async (raw: ClubdeskInventoryItemPayload): Promise<boolean> => {
      const payload = normalizeClubdeskInventoryItemPayload({
        ...raw,
        slug:
          raw.slug?.trim() ||
          slugify(raw.articleName.trim()) ||
          `inventory-${Date.now().toString(36)}`,
        publicationStatus: raw.publicationStatus === 'published' ? 'published' : 'draft',
        featured: raw.featured === true,
      });
      const errors = validateInventory(payload);
      setValidationErrors(errors);
      if (errors.length > 0) {
        return false;
      }
      try {
        setIsSaving(true);
        if (currentInventoryItem) {
          const saved = await clubdeskApi.updateInventoryItem(currentInventoryItem.id, payload);
          setInventoryItems((prev) =>
            prev.map((row) => (String(row.id) === String(saved.id) ? saved : row)),
          );
          setCurrentInventoryItem(saved);
          setPanelMode('view');
        } else {
          const saved = await clubdeskApi.createInventoryItem(payload);
          setInventoryItems((prev) => [saved, ...prev]);
          setIsClubdeskPanelOpen(false);
          setCurrentInventoryItem(null);
          setPanelMode('create');
        }
        clearValidationErrors();
        return true;
      } catch (err) {
        const error = err as { errors?: ValidationError[] };
        if (Array.isArray(error.errors)) {
          setValidationErrors(error.errors);
        } else {
          setValidationErrors([{ field: 'general', message: t('clubdesk.inventory.saveFailed') }]);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      clearValidationErrors,
      currentInventoryItem,
      setIsClubdeskPanelOpen,
      setPanelMode,
      setValidationErrors,
      t,
      validateInventory,
    ],
  );

  const deleteInventoryItem = useCallback(
    async (id: string) => {
      await clubdeskApi.deleteInventoryItem(id);
      setInventoryItems((prev) => prev.filter((row) => String(row.id) !== String(id)));
      if (currentInventoryItem && String(currentInventoryItem.id) === String(id)) {
        setCurrentInventoryItem(null);
      }
    },
    [currentInventoryItem],
  );

  const deleteInventoryItems = useCallback(
    async (ids: string[]) => {
      for (const id of ids) {
        await deleteInventoryItem(id);
      }
      bulk.clearSelection();
    },
    [bulk, deleteInventoryItem],
  );

  const updateInventoryVariantQuantity = useCallback(
    async (itemId: string, variantId: string, quantity: number) => {
      setIsSaving(true);
      try {
        await clubdeskApi.updateInventoryVariantQuantity(itemId, variantId, quantity);
        const full = await clubdeskApi.getInventoryItem(itemId);
        setInventoryItems((prev) =>
          prev.map((row) => (String(row.id) === String(full.id) ? full : row)),
        );
        setCurrentInventoryItem((current) =>
          current && String(current.id) === String(full.id) ? full : current,
        );
        return true;
      } catch {
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const importInventoryItems = useCallback(
    async (data: Record<string, string>[]): Promise<ImportResult> => {
      const failureCounts = createEmptyInventoryImportFailureCounts();
      try {
        const { payloads, skippedRowCount, skippedEmptyArticle, skippedArticleUnmapped } =
          groupInventoryImportRows(data);
        failureCounts.emptyArticle = skippedEmptyArticle;
        failureCounts.articleUnmapped = skippedArticleUnmapped;
        failureCounts.missingArticle = Math.max(
          0,
          skippedRowCount - skippedEmptyArticle - skippedArticleUnmapped,
        );

        const toImport: ClubdeskInventoryItemPayload[] = [];
        for (const rawPayload of payloads) {
          const payload = normalizeClubdeskInventoryItemPayload(rawPayload);
          const errors = validateInventory(payload);
          if (errors.length > 0) {
            recordInventoryValidationFailure(failureCounts, payload);
            continue;
          }
          toImport.push(payload);
        }

        let successCount = 0;
        if (toImport.length > 0) {
          const result = await clubdeskApi.importInventoryItems(toImport);
          successCount = result.successCount;
          if (Array.isArray(result.failures)) {
            for (const failure of result.failures) {
              const payload = toImport[failure.index];
              if (payload) {
                recordInventoryApiFailure(failureCounts, payload, failure.message);
              }
            }
          }
          if (successCount > 0) {
            const rows = await clubdeskApi.getInventoryItems();
            setInventoryItems(rows);
          }
        }

        const failureCount = inventoryImportFailureTotal(failureCounts);
        const failureMessages = buildInventoryImportFailureMessages(failureCounts, t);
        return { successCount, failureCount, failureMessages };
      } catch (err) {
        console.error('Clubdesk inventory import failed:', err);
        return {
          successCount: 0,
          failureCount: data.length,
          failureMessages: [t('clubdesk.inventory.importFailureUnexpected')],
        };
      }
    },
    [t, validateInventory],
  );

  const inventoryNav = usePluginNavigation(
    inventoryItems,
    currentInventoryItem,
    openInventoryForView,
  );

  const getInventoryDeleteMessage = (item: ClubdeskInventoryItem | null) =>
    item?.articleName?.trim()
      ? t('clubdesk.inventory.deleteConfirm', { name: item.articleName.trim() })
      : t('clubdesk.inventory.deleteConfirmGeneric');

  return {
    inventoryItems,
    setInventoryItems,
    currentInventoryItem,
    setCurrentInventoryItem,
    isSaving,
    recentlyDuplicatedInventoryId,
    setRecentlyDuplicatedInventoryId,
    ensureFullInventoryItem,
    openInventoryPanel,
    openInventoryForEdit,
    openInventoryForView,
    saveInventoryItem,
    deleteInventoryItem,
    deleteInventoryItems,
    updateInventoryVariantQuantity,
    importInventoryItems,
    getInventoryDeleteMessage,
    inventoryNav,
    inventoryBulk: bulk,
    inventoryValidationErrors: validationErrors,
    setInventoryValidationErrors: setValidationErrors,
    clearInventoryValidationErrors: clearValidationErrors,
    inventoryPanelModeRef,
  };
}
