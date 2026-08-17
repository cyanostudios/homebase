import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
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

import { GarmentContext, type GarmentContextType } from './GarmentContext';

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
  const { navigateToItem, navigateToBase } = useItemUrl('/garments');

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
    if (!location.pathname.startsWith('/garments') && garmentsContentView !== 'lists') {
      setGarmentsContentView('lists');
    }
  }, [location.pathname, garmentsContentView]);

  const closeGarmentPanel = useCallback(() => {
    setIsGarmentPanelOpen(false);
    setCurrentGarment(null);
    setCurrentInventoryItem(null);
    setPanelMode('create');
    setPanelKind('list');
    clearValidationErrors();
    navigateToBase();
  }, [clearValidationErrors, navigateToBase]);

  useEffect(() => {
    registerPanelCloseFunction('garments', closeGarmentPanel);
    return () => unregisterPanelCloseFunction('garments');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeGarmentPanel]);

  const openGarmentPanel = useCallback(
    (list: GarmentList | null) => {
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
    setGarmentsContentView('lists');
  }, []);

  const openGarmentsInventory = useCallback(() => {
    setGarmentsContentView('inventory');
  }, []);

  const openGarmentsLists = useCallback(() => {
    setGarmentsContentView('lists');
  }, []);

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
    (data: InventoryItemPayload): ValidationError[] => {
      const errors: ValidationError[] = [];
      if (!data.articleName.trim()) {
        errors.push({ field: 'articleName', message: t('garments.articleNameRequired') });
      }
      if (data.quantity != null && (Number.isNaN(data.quantity) || data.quantity < 0)) {
        errors.push({ field: 'quantity', message: t('garments.quantityInvalid') });
      }
      return errors;
    },
    [t],
  );

  const saveInventoryItem = useCallback(
    async (raw: InventoryItemPayload): Promise<boolean> => {
      const payload: InventoryItemPayload = {
        articleName: raw.articleName.trim(),
        brand: (raw.brand ?? '').trim(),
        size: (raw.size ?? '').trim(),
        quantity: raw.quantity != null ? Number(raw.quantity) : 0,
        comment: raw.comment?.trim() ? raw.comment.trim() : null,
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
          setInventoryItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
          setCurrentInventoryItem(saved);
          setCurrentGarment(inventoryProxyList(saved));
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
      clearValidationErrors,
      closeGarmentPanel,
      currentInventoryItem,
      setValidationErrors,
      t,
      validateInventory,
    ],
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
      deleteInventoryItem,
      deleteInventoryItems,
      refreshGarmentList,
      addPerson,
      updatePerson,
      deletePerson,
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
      deleteInventoryItem,
      deleteInventoryItems,
      refreshGarmentList,
      addPerson,
      updatePerson,
      deletePerson,
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
    ],
  );

  return <GarmentContext.Provider value={value}>{children}</GarmentContext.Provider>;
}
