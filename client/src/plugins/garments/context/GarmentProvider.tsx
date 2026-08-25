import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { GARMENTS_SUBPAGE_SET, resolveGarmentPanelClosePath } from '@/core/routing/garmentsRoutes';
import { pathToNavPage } from '@/core/routing/routeMap';
import { buildSlug, resolveSlug } from '@/core/utils/slugUtils';

import { garmentShareApi, garmentsApi } from '../api/garmentsApi';
import type {
  GarmentList,
  GarmentListPayload,
  GarmentPanelKind,
  GarmentPerson,
  GarmentPersonPayload,
  GarmentShare,
  GarmentsContentView,
  InventoryItem,
  InventoryItemPayload,
  ValidationError,
} from '../types/garments';
import { createDefaultCheckboxColumns } from '../utils/defaultCheckboxTemplate';
import {
  buildDuplicatedItemVariantPayloads,
  validateInventoryPayload,
} from '../utils/inventoryValidation';

import { GarmentContext, type GarmentContextType } from './GarmentContext';

function isInventoryItem(item: GarmentList | InventoryItem): item is InventoryItem {
  return 'articleName' in item;
}

interface GarmentProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

function inventoryProxyList(item: InventoryItem): GarmentList {
  return {
    id: item.id,
    name: item.articleName,
    teamId: null,
    checkboxColumns: [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function GarmentProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: GarmentProviderProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem } = useItemUrl('/garments');

  const [isGarmentPanelOpen, setIsGarmentPanelOpen] = useState(false);
  const [currentGarment, setCurrentGarment] = useState<GarmentList | null>(null);
  const [currentInventoryItem, setCurrentInventoryItem] = useState<InventoryItem | null>(null);
  const [panelMode, setPanelMode] = useState<GarmentContextType['panelMode']>('create');
  const [panelKind, setPanelKind] = useState<GarmentPanelKind>('list');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<ValidationError>();
  const [garmentLists, setGarmentLists] = useState<GarmentList[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [garmentsContentView, setGarmentsContentView] = useState<GarmentsContentView>('lists');
  const [isSaving, setIsSaving] = useState(false);
  const [recentlyDuplicatedInventoryId, setRecentlyDuplicatedInventoryId] = useState<string | null>(
    null,
  );
  const [recentlyDuplicatedListId, setRecentlyDuplicatedListId] = useState<string | null>(null);

  const [garmentShareExistingShare, setGarmentShareExistingShare] = useState<GarmentShare | null>(
    null,
  );
  const [garmentShareShowDialog, setGarmentShareShowDialog] = useState(false);
  const [garmentShareIsCreatingShare, setGarmentShareIsCreatingShare] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setGarmentLists([]);
      setInventoryItems([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [lists, inventory] = await Promise.all([
          garmentsApi.getLists(),
          garmentsApi.getInventory(),
        ]);
        if (!cancelled) {
          setGarmentLists(lists);
          setInventoryItems(inventory);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load garments:', err);
          setValidationErrors([{ field: 'general', message: t('garments.loadFailed') }]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setValidationErrors, t]);

  useEffect(() => {
    if (!location.pathname.startsWith('/garments')) {
      if (garmentsContentView !== 'lists') {
        setGarmentsContentView('lists');
      }
      return;
    }
    if (garmentsContentView === 'settings') {
      return;
    }
    const page = pathToNavPage(location.pathname);
    const nextView = page === 'garments-inventory' ? 'inventory' : 'lists';
    if (garmentsContentView !== nextView) {
      setGarmentsContentView(nextView);
    }
  }, [location.pathname, garmentsContentView]);

  const closeGarmentPanel = useCallback(() => {
    // Prefer window.location: handlePageChange navigates first, then closes
    // panels in the same tick — React's location is still the list item URL.
    const pathname = window.location.pathname;
    const returnToInventory =
      panelKind === 'inventory' ||
      garmentsContentView === 'inventory' ||
      pathname.startsWith('/garments/inventory');
    setIsGarmentPanelOpen(false);
    setCurrentGarment(null);
    setCurrentInventoryItem(null);
    setPanelMode('create');
    setPanelKind('list');
    clearValidationErrors();
    if (returnToInventory) {
      setGarmentsContentView('inventory');
    }
    const target = resolveGarmentPanelClosePath(pathname, { returnToInventory });
    if (target) {
      navigate(target);
    }
  }, [clearValidationErrors, garmentsContentView, navigate, panelKind]);

  useEffect(() => {
    registerPanelCloseFunction('garments', closeGarmentPanel);
    return () => unregisterPanelCloseFunction('garments');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeGarmentPanel]);

  const openGarmentPanel = useCallback(
    (list: GarmentList | null) => {
      setRecentlyDuplicatedInventoryId(null);
      setRecentlyDuplicatedListId(null);
      setPanelKind('list');
      setCurrentInventoryItem(null);
      setCurrentGarment(list);
      setPanelMode(list ? 'edit' : 'create');
      setIsGarmentPanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
      if (list) {
        navigateToItem(list, garmentLists, 'name');
      }
    },
    [clearValidationErrors, navigateToItem, onCloseOtherPanels, garmentLists],
  );

  const openGarmentForEdit = useCallback(
    (list: GarmentList) => {
      setRecentlyDuplicatedInventoryId(null);
      setRecentlyDuplicatedListId(null);
      if (panelKind === 'inventory' && currentInventoryItem) {
        setPanelMode('edit');
        setIsGarmentPanelOpen(true);
        clearValidationErrors();
        onCloseOtherPanels();
        return;
      }
      setPanelKind('list');
      setCurrentInventoryItem(null);
      setCurrentGarment(list);
      setPanelMode('edit');
      setIsGarmentPanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
      navigateToItem(list, garmentLists, 'name');
    },
    [
      clearValidationErrors,
      currentInventoryItem,
      garmentLists,
      navigateToItem,
      onCloseOtherPanels,
      panelKind,
    ],
  );

  const openGarmentForViewRef = useRef<(list: GarmentList) => void>(() => {});
  const openGarmentForView = useCallback(
    (list: GarmentList) => {
      setRecentlyDuplicatedInventoryId(null);
      setRecentlyDuplicatedListId(null);
      if (
        panelKind === 'inventory' &&
        currentInventoryItem &&
        list.id === currentInventoryItem.id
      ) {
        setPanelMode('view');
        setIsGarmentPanelOpen(true);
        clearValidationErrors();
        onCloseOtherPanels();
        return;
      }
      if (!window.location.pathname.startsWith('/garments')) {
        navigate(`/garments/${buildSlug(list, garmentLists, 'name')}`);
        return;
      }
      setPanelKind('list');
      setCurrentInventoryItem(null);
      setCurrentGarment(list);
      setPanelMode('view');
      setIsGarmentPanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
      navigateToItem(list, garmentLists, 'name');
      void garmentsApi
        .getList(list.id)
        .then((full) => {
          setCurrentGarment(full);
          setGarmentLists((prev) => prev.map((l) => (l.id === full.id ? { ...l, ...full } : l)));
        })
        .catch(() => {});
    },
    [
      clearValidationErrors,
      currentInventoryItem,
      garmentLists,
      navigate,
      navigateToItem,
      onCloseOtherPanels,
      panelKind,
    ],
  );
  useEffect(() => {
    openGarmentForViewRef.current = openGarmentForView;
  }, [openGarmentForView]);

  const openInventoryPanel = useCallback(
    (item: InventoryItem | null) => {
      setRecentlyDuplicatedInventoryId(null);
      setRecentlyDuplicatedListId(null);
      setPanelKind('inventory');
      setCurrentInventoryItem(item);
      setCurrentGarment(item ? inventoryProxyList(item) : null);
      setPanelMode(item ? 'edit' : 'create');
      setIsGarmentPanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
    },
    [clearValidationErrors, onCloseOtherPanels],
  );

  const openInventoryForEdit = useCallback(
    (item: InventoryItem) => {
      setRecentlyDuplicatedInventoryId(null);
      setRecentlyDuplicatedListId(null);
      setPanelKind('inventory');
      setCurrentInventoryItem(item);
      setCurrentGarment(inventoryProxyList(item));
      setPanelMode('edit');
      setIsGarmentPanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
    },
    [clearValidationErrors, onCloseOtherPanels],
  );

  const openInventoryForView = useCallback(
    (item: InventoryItem) => {
      setRecentlyDuplicatedInventoryId(null);
      setRecentlyDuplicatedListId(null);
      setPanelKind('inventory');
      setCurrentInventoryItem(item);
      setCurrentGarment(inventoryProxyList(item));
      setPanelMode('view');
      setIsGarmentPanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
    },
    [clearValidationErrors, onCloseOtherPanels],
  );

  const listNav = usePluginNavigation(
    garmentLists,
    panelKind === 'list' ? currentGarment : null,
    openGarmentForView,
  );
  const inventoryNav = usePluginNavigation(
    inventoryItems,
    panelKind === 'inventory' ? currentInventoryItem : null,
    openInventoryForView,
  );
  const nav = panelKind === 'inventory' ? inventoryNav : listNav;

  const deepLinkSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (garmentLists.length === 0) {
      return;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'garments') {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug) {
      deepLinkSyncedRef.current = location.pathname;
      return;
    }
    const pathKey = location.pathname;
    if (deepLinkSyncedRef.current === pathKey) {
      return;
    }
    if (GARMENTS_SUBPAGE_SET.has(slug)) {
      deepLinkSyncedRef.current = pathKey;
      return;
    }
    const item = resolveSlug(slug, garmentLists, 'name');
    deepLinkSyncedRef.current = pathKey;
    if (item) {
      openGarmentForViewRef.current(item as GarmentList);
    }
  }, [location.pathname, garmentLists]);

  const openGarmentsSettings = useCallback(() => {
    setGarmentsContentView('settings');
  }, []);

  const closeGarmentSettingsView = useCallback(() => {
    const page = pathToNavPage(location.pathname);
    setGarmentsContentView(page === 'garments-inventory' ? 'inventory' : 'lists');
  }, [location.pathname]);

  const openGarmentsInventory = useCallback(() => {
    setGarmentsContentView('inventory');
    navigate('/garments/inventory');
  }, [navigate]);

  const openGarmentsLists = useCallback(() => {
    setGarmentsContentView('lists');
    navigate('/garments');
  }, [navigate]);

  const validateList = useCallback(
    (data: GarmentListPayload): ValidationError[] => {
      const errors: ValidationError[] = [];
      if (!data.name.trim()) {
        errors.push({ field: 'name', message: t('garments.nameRequired') });
      }
      return errors;
    },
    [t],
  );

  const validateInventory = useCallback(
    (data: InventoryItemPayload) =>
      validateInventoryPayload(data, {
        articleNameRequired: t('garments.articleNameRequired'),
        purchasePriceInvalid: t('garments.purchasePriceInvalid'),
        recommendedPriceInvalid: t('garments.recommendedPriceInvalid'),
        salePriceInvalid: t('garments.salePriceInvalid'),
        quantityInvalid: t('garments.quantityInvalid'),
      }),
    [t],
  );

  const applyInventoryItemUpdate = useCallback((saved: InventoryItem) => {
    setInventoryItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
    setCurrentInventoryItem((current) => (current && current.id === saved.id ? saved : current));
    setCurrentGarment((current) =>
      current && String(current.id) === String(saved.id) ? inventoryProxyList(saved) : current,
    );
  }, []);

  const updateInventoryVariantQuantity = useCallback(
    async (itemId: string, variantId: string, quantity: number): Promise<boolean> => {
      const nextQty = Math.max(0, Math.floor(Number(quantity)));
      if (Number.isNaN(nextQty) || nextQty < 0) {
        return false;
      }
      const existing = inventoryItems.find((i) => String(i.id) === String(itemId));
      if (!existing) {
        return false;
      }
      const currentVariant = (existing.variants || []).find(
        (v) => String(v.id) === String(variantId),
      );
      if (currentVariant && currentVariant.quantity === nextQty) {
        return true;
      }
      try {
        setIsSaving(true);
        const variant = await garmentsApi.updateInventoryVariantQuantity(
          itemId,
          variantId,
          nextQty,
        );
        const patchItem = (item: InventoryItem): InventoryItem => {
          if (String(item.id) !== String(itemId)) {
            return item;
          }
          const variants = (item.variants || []).map((row) =>
            String(row.id) === String(variantId) ? variant : row,
          );
          const totalQuantity = variants.reduce((sum, row) => sum + (row.quantity || 0), 0);
          return {
            ...item,
            variants,
            totalQuantity,
            variantCount: variants.length,
            updatedAt: new Date().toISOString(),
          };
        };
        setInventoryItems((prev) => prev.map(patchItem));
        setCurrentInventoryItem((current) => (current ? patchItem(current) : current));
        return true;
      } catch (err) {
        console.error('Failed to update inventory variant quantity:', err);
        setValidationErrors([{ field: 'quantity', message: t('garments.quantityUpdateFailed') }]);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [inventoryItems, setValidationErrors, t],
  );

  const saveInventoryItem = useCallback(
    async (raw: InventoryItemPayload): Promise<boolean> => {
      const purchaseRaw = raw.purchasePrice;
      let purchasePrice: number | null = null;
      if (purchaseRaw !== undefined && purchaseRaw !== null && String(purchaseRaw) !== '') {
        const num =
          typeof purchaseRaw === 'number'
            ? purchaseRaw
            : parseFloat(String(purchaseRaw).replace(',', '.'));
        purchasePrice = Number.isNaN(num) ? null : num;
      }
      const recommendedRaw = raw.recommendedPrice;
      let recommendedPrice: number | null = null;
      if (
        recommendedRaw !== undefined &&
        recommendedRaw !== null &&
        String(recommendedRaw) !== ''
      ) {
        const num =
          typeof recommendedRaw === 'number'
            ? recommendedRaw
            : parseFloat(String(recommendedRaw).replace(',', '.'));
        recommendedPrice = Number.isNaN(num) ? null : num;
      }
      const saleRaw = raw.salePrice;
      let salePrice: number | null = null;
      if (saleRaw !== undefined && saleRaw !== null && String(saleRaw) !== '') {
        const num =
          typeof saleRaw === 'number' ? saleRaw : parseFloat(String(saleRaw).replace(',', '.'));
        salePrice = Number.isNaN(num) ? null : num;
      }
      const variants = Array.isArray(raw.variants)
        ? raw.variants.map((variant, index) => ({
            id: variant.id,
            sku: (variant.sku ?? '').trim(),
            audience: (variant.audience ?? '').trim(),
            color: (variant.color ?? '').trim(),
            size: (variant.size ?? '').trim(),
            quantity: variant.quantity != null ? Number(variant.quantity) : 0,
            sortOrder: variant.sortOrder ?? index,
          }))
        : [];
      const payload: InventoryItemPayload = {
        articleName: raw.articleName.trim(),
        brand: (raw.brand ?? '').trim(),
        description: raw.description?.trim() ? raw.description.trim() : null,
        material: (raw.material ?? '').trim(),
        purchasePrice,
        recommendedPrice,
        salePrice,
        currency: (raw.currency ?? 'SEK').trim() || 'SEK',
        comment: raw.comment?.trim() ? raw.comment.trim() : null,
        variants,
      };
      const errors = validateInventory(payload);
      setValidationErrors(errors);
      if (errors.length > 0) {
        return false;
      }
      try {
        setIsSaving(true);
        if (currentInventoryItem) {
          const saved = await garmentsApi.updateInventoryItem(currentInventoryItem.id, payload);
          applyInventoryItemUpdate(saved);
          setPanelMode('view');
        } else {
          const saved = await garmentsApi.createInventoryItem(payload);
          setInventoryItems((prev) => [saved, ...prev]);
          closeGarmentPanel();
        }
        clearValidationErrors();
        return true;
      } catch (err) {
        const error = err as { errors?: ValidationError[]; status?: number };
        console.error('Failed to save inventory item:', err);
        if (Array.isArray(error.errors)) {
          setValidationErrors(error.errors);
        } else {
          setValidationErrors([{ field: 'general', message: t('garments.saveFailed') }]);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      applyInventoryItemUpdate,
      clearValidationErrors,
      closeGarmentPanel,
      currentInventoryItem,
      setValidationErrors,
      t,
      validateInventory,
    ],
  );

  const createInventoryDuplicate = useCallback(
    async (item: InventoryItem, newName: string): Promise<InventoryItem> => {
      const nextName =
        (newName ?? '').trim() || item.articleName?.trim() || t('garments.inventoryItem');
      const payload: InventoryItemPayload = {
        articleName: nextName,
        brand: item.brand ?? '',
        description: item.description,
        material: item.material ?? '',
        purchasePrice: item.purchasePrice,
        currency: item.currency || 'SEK',
        comment: item.comment,
        variants: buildDuplicatedItemVariantPayloads(item.variants || []),
      };
      const created = await garmentsApi.createInventoryItem(payload);
      setInventoryItems((prev) => [created, ...prev]);
      setGarmentsContentView('inventory');
      navigate('/garments/inventory');
      return created;
    },
    [navigate, t],
  );

  const createListDuplicate = useCallback(
    async (item: GarmentList, newName: string): Promise<GarmentList> => {
      const nextName = (newName ?? '').trim() || item.name?.trim() || t('garments.list');
      const source =
        item.persons && item.persons.length > 0
          ? item
          : ((await garmentsApi.getList(item.id)) ?? item);
      const created = await garmentsApi.createList({
        name: nextName,
        teamId: source.teamId ?? null,
        checkboxColumns:
          source.checkboxColumns?.length > 0
            ? source.checkboxColumns
            : createDefaultCheckboxColumns(),
      });
      for (const person of source.persons ?? []) {
        await garmentsApi.createPerson(created.id, {
          name: person.name,
          shirtSize: person.shirtSize,
          shortsSize: person.shortsSize,
          socksSize: person.socksSize,
          jerseyNumber: person.jerseyNumber,
          jerseyName: person.jerseyName,
          initials: person.initials,
          comment: person.comment,
          contactId: person.contactId,
          checkboxValues: person.checkboxValues ?? {},
          sortOrder: person.sortOrder,
        });
      }
      const full = (await garmentsApi.getList(created.id)) ?? created;
      setGarmentLists((prev) => [full, ...prev]);
      setGarmentsContentView('lists');
      navigate('/garments');
      return full;
    },
    [navigate, t],
  );

  const getDuplicateConfig = useCallback(
    (item: GarmentList | InventoryItem | null) => {
      if (!item) {
        return null;
      }
      if (isInventoryItem(item)) {
        return {
          defaultName: `Copy of ${item.articleName?.trim() || t('garments.inventoryItem')}`,
          nameLabel: t('garments.articleName'),
          confirmOnly: false,
        };
      }
      return {
        defaultName: `Copy of ${item.name?.trim() || t('garments.list')}`,
        nameLabel: t('garments.name'),
        confirmOnly: false,
      };
    },
    [t],
  );

  const executeDuplicate = useCallback(
    async (
      item: GarmentList | InventoryItem,
      newName: string,
    ): Promise<{ closePanel: () => void; highlightId?: string }> => {
      const created = isInventoryItem(item)
        ? await createInventoryDuplicate(item, newName)
        : await createListDuplicate(item, newName);
      const highlightId = created?.id != null ? String(created.id) : undefined;
      return { closePanel: closeGarmentPanel, highlightId };
    },
    [closeGarmentPanel, createInventoryDuplicate, createListDuplicate],
  );

  const saveGarment = useCallback(
    async (raw: GarmentListPayload | InventoryItemPayload): Promise<boolean> => {
      if (panelKind === 'inventory') {
        return saveInventoryItem(raw as InventoryItemPayload);
      }
      const data = raw as GarmentListPayload;
      const payload: GarmentListPayload = {
        name: data.name.trim(),
        teamId: data.teamId != null && data.teamId !== '' ? String(data.teamId) : null,
        checkboxColumns:
          data.checkboxColumns ??
          (currentGarment?.checkboxColumns?.length
            ? currentGarment.checkboxColumns
            : createDefaultCheckboxColumns()),
      };
      const errors = validateList(payload);
      setValidationErrors(errors);
      if (errors.length > 0) {
        return false;
      }
      try {
        setIsSaving(true);
        if (currentGarment && panelKind === 'list') {
          const saved = await garmentsApi.updateList(currentGarment.id, payload);
          setGarmentLists((prev) => prev.map((l) => (l.id === saved.id ? { ...l, ...saved } : l)));
          setCurrentGarment((prev) => (prev ? { ...prev, ...saved } : saved));
          setPanelMode('view');
        } else {
          const saved = await garmentsApi.createList({
            ...payload,
            checkboxColumns: payload.checkboxColumns ?? createDefaultCheckboxColumns(),
          });
          setGarmentLists((prev) => [saved, ...prev]);
          closeGarmentPanel();
        }
        clearValidationErrors();
        return true;
      } catch (err) {
        const error = err as { errors?: ValidationError[] };
        console.error('Failed to save garment list:', err);
        if (Array.isArray(error.errors)) {
          setValidationErrors(error.errors);
        } else {
          setValidationErrors([{ field: 'general', message: t('garments.saveFailed') }]);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      clearValidationErrors,
      closeGarmentPanel,
      currentGarment,
      panelKind,
      saveInventoryItem,
      setValidationErrors,
      t,
      validateList,
    ],
  );

  const deleteGarment = useCallback(
    async (id: string) => {
      if (panelKind === 'inventory') {
        try {
          await garmentsApi.deleteInventoryItem(id);
          setInventoryItems((prev) => prev.filter((i) => i.id !== id));
          if (currentInventoryItem?.id === id) {
            closeGarmentPanel();
          }
        } catch (err) {
          console.error('Failed to delete inventory item:', err);
        }
        return;
      }
      try {
        await garmentsApi.deleteList(id);
        setGarmentLists((prev) => prev.filter((l) => l.id !== id));
        if (currentGarment?.id === id) {
          closeGarmentPanel();
        }
      } catch (err) {
        console.error('Failed to delete garment list:', err);
      }
    },
    [closeGarmentPanel, currentGarment?.id, currentInventoryItem?.id, panelKind],
  );

  const deleteGarments = useCallback(
    async (ids: string[]) => {
      for (const id of ids) {
        await deleteGarment(id);
      }
    },
    [deleteGarment],
  );

  const deleteInventoryItem = useCallback(
    async (id: string) => {
      try {
        await garmentsApi.deleteInventoryItem(id);
        setInventoryItems((prev) => prev.filter((i) => i.id !== id));
        if (currentInventoryItem?.id === id) {
          closeGarmentPanel();
        }
      } catch (err) {
        console.error('Failed to delete inventory item:', err);
      }
    },
    [closeGarmentPanel, currentInventoryItem?.id],
  );

  const deleteInventoryItems = useCallback(
    async (ids: string[]) => {
      for (const id of ids) {
        await deleteInventoryItem(id);
      }
    },
    [deleteInventoryItem],
  );

  const refreshGarmentList = useCallback(async (listId: string) => {
    try {
      const full = await garmentsApi.getList(listId);
      setGarmentLists((prev) => prev.map((l) => (l.id === full.id ? { ...l, ...full } : l)));
      setCurrentGarment((prev) => (prev?.id === full.id ? { ...prev, ...full } : prev));
      return full;
    } catch (err) {
      console.error('Failed to refresh garment list:', err);
      return null;
    }
  }, []);

  const addPerson = useCallback(
    async (listId: string, data: GarmentPersonPayload): Promise<GarmentPerson | null> => {
      try {
        const person = await garmentsApi.createPerson(listId, data);
        await refreshGarmentList(listId);
        return person;
      } catch (err) {
        console.error('Failed to add person:', err);
        return null;
      }
    },
    [refreshGarmentList],
  );

  const updatePerson = useCallback(
    async (
      listId: string,
      personId: string,
      data: GarmentPersonPayload,
    ): Promise<GarmentPerson | null> => {
      try {
        const person = await garmentsApi.updatePerson(listId, personId, data);
        setCurrentGarment((prev) => {
          if (!prev || prev.id !== listId || !prev.persons) {
            return prev;
          }
          return {
            ...prev,
            persons: prev.persons.map((p) => (p.id === person.id ? person : p)),
          };
        });
        return person;
      } catch (err) {
        console.error('Failed to update person:', err);
        return null;
      }
    },
    [],
  );

  const deletePerson = useCallback(
    async (listId: string, personId: string) => {
      try {
        await garmentsApi.deletePerson(listId, personId);
        await refreshGarmentList(listId);
      } catch (err) {
        console.error('Failed to delete person:', err);
      }
    },
    [refreshGarmentList],
  );

  const importPersons = useCallback(
    async (
      listId: string,
      data: Record<string, string>[],
    ): Promise<{ successCount: number; failureCount: number }> => {
      let successCount = 0;
      let failureCount = 0;
      for (const row of data) {
        const name = String(row.name ?? '').trim();
        if (!name) {
          failureCount += 1;
          continue;
        }
        const contactIdRaw = row.contactId ?? row.contact_id;
        const contactId =
          contactIdRaw != null && String(contactIdRaw).trim() !== ''
            ? String(contactIdRaw).trim()
            : undefined;
        try {
          await garmentsApi.createPerson(listId, {
            name,
            ...(contactId ? { contactId } : {}),
          });
          successCount += 1;
        } catch (err) {
          console.error('Failed to import person:', err);
          failureCount += 1;
        }
      }
      if (successCount > 0) {
        await refreshGarmentList(listId);
      }
      return { successCount, failureCount };
    },
    [refreshGarmentList],
  );

  useEffect(() => {
    if (panelMode === 'view' && panelKind === 'list' && currentGarment?.id) {
      let cancelled = false;
      garmentShareApi
        .getShares(currentGarment.id)
        .then((shares) => {
          if (cancelled) {
            return;
          }
          const active = shares.find((s) => new Date(s.validUntil) > new Date());
          setGarmentShareExistingShare(active || null);
        })
        .catch(() => {
          if (!cancelled) {
            setGarmentShareExistingShare(null);
          }
        });
      return () => {
        cancelled = true;
      };
    }
    setGarmentShareExistingShare(null);
  }, [panelMode, panelKind, currentGarment?.id]);

  const defaultShareValidUntil = useCallback((): Date => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const handleGarmentShareClick = useCallback(
    async (list: GarmentList) => {
      if (garmentShareExistingShare) {
        setGarmentShareShowDialog(true);
        return;
      }
      setGarmentShareIsCreatingShare(true);
      try {
        const share = await garmentShareApi.createShare({
          listId: list.id,
          validUntil: defaultShareValidUntil(),
        });
        setGarmentShareExistingShare(share);
        setGarmentShareShowDialog(true);
      } catch (error) {
        console.error('Failed to create garment share:', error);
        alert(error instanceof Error ? error.message : t('garments.shareCreateFailed'));
      } finally {
        setGarmentShareIsCreatingShare(false);
      }
    },
    [defaultShareValidUntil, garmentShareExistingShare, t],
  );

  const handleGarmentCopyShareUrl = useCallback(() => {
    if (!garmentShareExistingShare) {
      return;
    }
    const url = garmentShareApi.generateShareUrl(garmentShareExistingShare.shareToken);
    navigator.clipboard.writeText(url).catch(() => {});
  }, [garmentShareExistingShare]);

  const handleGarmentRevokeShare = useCallback(async () => {
    if (!garmentShareExistingShare) {
      return;
    }
    try {
      await garmentShareApi.revokeShare(garmentShareExistingShare.id);
      setGarmentShareExistingShare(null);
    } catch (error) {
      console.error('Failed to revoke garment share:', error);
      alert(t('garments.shareRevokeFailed'));
    }
  }, [garmentShareExistingShare, t]);

  const getPanelTitle = useCallback(
    (mode: string, item: GarmentList | InventoryItem | null) => {
      if (panelKind === 'inventory') {
        if (mode === 'create') {
          return t('garments.newInventoryItem');
        }
        const inv = currentInventoryItem;
        return inv?.articleName || t('garments.inventoryItem');
      }
      if (mode === 'create') {
        return t('garments.newList');
      }
      const list = item && 'checkboxColumns' in item ? item : currentGarment;
      return list?.name || t('garments.list');
    },
    [currentGarment, currentInventoryItem, panelKind, t],
  );

  const getPanelSubtitle = useCallback(
    (mode: string, _item: GarmentList | InventoryItem | null) => {
      if (panelKind === 'inventory') {
        if (mode === 'create') {
          return t('garments.inventorySubtitle');
        }
        return t('garments.inventoryItem');
      }
      if (mode === 'create') {
        return t('garments.listSubtitle');
      }
      return t('garments.list');
    },
    [panelKind, t],
  );

  const getDeleteMessage = useCallback(
    (item: GarmentList | InventoryItem | null) => {
      if (panelKind === 'inventory') {
        const name = currentInventoryItem?.articleName || (item as InventoryItem)?.articleName;
        if (name) {
          return t('garments.deleteInventoryConfirm', { name });
        }
        return t('garments.deleteInventoryConfirmGeneric');
      }
      const name = (item as GarmentList)?.name || currentGarment?.name;
      if (name) {
        return t('garments.deleteListConfirm', { name });
      }
      return t('garments.deleteListConfirmGeneric');
    },
    [currentGarment?.name, currentInventoryItem?.articleName, panelKind, t],
  );

  const value = useMemo<GarmentContextType>(
    () => ({
      isGarmentPanelOpen,
      currentGarment,
      currentInventoryItem,
      panelMode,
      panelKind,
      validationErrors,
      garmentLists,
      inventoryItems,
      garmentsContentView,
      isSaving,
      openGarmentPanel,
      openGarmentForEdit,
      openGarmentForView,
      closeGarmentPanel,
      openInventoryPanel,
      openInventoryForEdit,
      openInventoryForView,
      openGarmentsSettings,
      closeGarmentSettingsView,
      openGarmentsInventory,
      openGarmentsLists,
      saveGarment,
      deleteGarment,
      deleteGarments,
      saveInventoryItem,
      updateInventoryVariantQuantity,
      deleteInventoryItem,
      deleteInventoryItems,
      getDuplicateConfig,
      executeDuplicate,
      recentlyDuplicatedInventoryId,
      setRecentlyDuplicatedInventoryId,
      recentlyDuplicatedListId,
      setRecentlyDuplicatedListId,
      refreshGarmentList,
      addPerson,
      updatePerson,
      deletePerson,
      importPersons,
      garmentShareExistingShare,
      garmentShareShowDialog,
      setGarmentShareShowDialog,
      garmentShareIsCreatingShare,
      handleGarmentShareClick,
      handleGarmentCopyShareUrl,
      handleGarmentRevokeShare,
      getPanelTitle,
      getPanelSubtitle,
      getDeleteMessage,
      clearValidationErrors,
      navigateToPrevItem: nav.navigateToPrevItem,
      navigateToNextItem: nav.navigateToNextItem,
      hasPrevItem: nav.hasPrevItem,
      hasNextItem: nav.hasNextItem,
      currentItemIndex: nav.currentItemIndex,
      totalItems: nav.totalItems,
    }),
    [
      isGarmentPanelOpen,
      currentGarment,
      currentInventoryItem,
      panelMode,
      panelKind,
      validationErrors,
      garmentLists,
      inventoryItems,
      garmentsContentView,
      isSaving,
      openGarmentPanel,
      openGarmentForEdit,
      openGarmentForView,
      closeGarmentPanel,
      openInventoryPanel,
      openInventoryForEdit,
      openInventoryForView,
      openGarmentsSettings,
      closeGarmentSettingsView,
      openGarmentsInventory,
      openGarmentsLists,
      saveGarment,
      deleteGarment,
      deleteGarments,
      saveInventoryItem,
      updateInventoryVariantQuantity,
      deleteInventoryItem,
      deleteInventoryItems,
      getDuplicateConfig,
      executeDuplicate,
      recentlyDuplicatedInventoryId,
      recentlyDuplicatedListId,
      refreshGarmentList,
      addPerson,
      updatePerson,
      deletePerson,
      importPersons,
      garmentShareExistingShare,
      garmentShareShowDialog,
      garmentShareIsCreatingShare,
      handleGarmentShareClick,
      handleGarmentCopyShareUrl,
      handleGarmentRevokeShare,
      getPanelTitle,
      getPanelSubtitle,
      getDeleteMessage,
      clearValidationErrors,
      nav.navigateToPrevItem,
      nav.navigateToNextItem,
      nav.hasPrevItem,
      nav.hasNextItem,
      nav.currentItemIndex,
      nav.totalItems,
    ],
  );

  return <GarmentContext.Provider value={value}>{children}</GarmentContext.Provider>;
}
