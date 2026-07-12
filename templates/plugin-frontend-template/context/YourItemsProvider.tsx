import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { buildSlug, resolveSlug } from '@/core/utils/slugUtils';

import { templateApi } from '../api/templateApi';
import type { YourItem, YourItemPayload, ValidationError } from '../types/your-items';

import { YourItemsContext, type YourItemsContextType } from './YourItemsContext';

interface YourItemsProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function YourItemsProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: YourItemsProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/your-items');

  const [isYourItemsPanelOpen, setIsYourItemsPanelOpen] = useState(false);
  const [currentYourItem, setCurrentYourItem] = useState<YourItem | null>(null);
  const [panelMode, setPanelMode] = useState<YourItemsContextType['panelMode']>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<ValidationError>();
  const [yourItems, setYourItems] = useState<YourItem[]>([]);
  const [yourItemsContentView, setYourItemsContentView] = useState<'list' | 'settings'>('list');
  const [isSaving, setIsSaving] = useState(false);

  const loadItems = useCallback(async () => {
    const items = await templateApi.getItems();
    setYourItems(items);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setYourItems([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const items = await templateApi.getItems();
        if (!cancelled) {
          setYourItems(items);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load your-items:', err);
          setValidationErrors([{ field: 'general', message: 'Failed to load items.' }]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setValidationErrors]);

  const closeYourItemsPanel = useCallback(() => {
    setIsYourItemsPanelOpen(false);
    setCurrentYourItem(null);
    setPanelMode('create');
    clearValidationErrors();
    navigateToBase();
  }, [clearValidationErrors, navigateToBase]);

  useEffect(() => {
    registerPanelCloseFunction('your-items', closeYourItemsPanel);
    return () => unregisterPanelCloseFunction('your-items');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeYourItemsPanel]);

  const openYourItemsPanel = useCallback(
    (item: YourItem | null) => {
      setCurrentYourItem(item);
      setPanelMode(item ? 'edit' : 'create');
      setIsYourItemsPanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
      if (item) {
        navigateToItem(item, yourItems, 'title');
      }
    },
    [clearValidationErrors, navigateToItem, onCloseOtherPanels, yourItems],
  );

  const openYourItemForEdit = useCallback(
    (item: YourItem) => {
      setCurrentYourItem(item);
      setPanelMode('edit');
      setIsYourItemsPanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
      navigateToItem(item, yourItems, 'title');
    },
    [clearValidationErrors, navigateToItem, onCloseOtherPanels, yourItems],
  );

  const openYourItemForViewRef = useRef<(item: YourItem) => void>(() => {});
  const openYourItemForView = useCallback(
    (item: YourItem) => {
      if (!window.location.pathname.startsWith('/your-items')) {
        navigate(`/your-items/${buildSlug(item, yourItems, 'title')}`);
        return;
      }
      setCurrentYourItem(item);
      setPanelMode('view');
      setIsYourItemsPanelOpen(true);
      clearValidationErrors();
      onCloseOtherPanels();
      navigateToItem(item, yourItems, 'title');
    },
    [clearValidationErrors, navigate, navigateToItem, onCloseOtherPanels, yourItems],
  );
  useEffect(() => {
    openYourItemForViewRef.current = openYourItemForView;
  }, [openYourItemForView]);

  const yourItemsDeepLinkPathSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (yourItems.length === 0) {
      return;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'your-items') {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug) {
      yourItemsDeepLinkPathSyncedRef.current = location.pathname;
      return;
    }
    const pathKey = location.pathname;
    if (yourItemsDeepLinkPathSyncedRef.current === pathKey) {
      return;
    }
    const item = resolveSlug(slug, yourItems, 'title');
    yourItemsDeepLinkPathSyncedRef.current = pathKey;
    if (item) {
      openYourItemForViewRef.current(item as YourItem);
    }
  }, [location.pathname, yourItems]);

  const openYourItemsSettings = useCallback(() => {
    setYourItemsContentView('settings');
  }, []);

  const closeYourItemsSettingsView = useCallback(() => {
    setYourItemsContentView('list');
  }, []);

  const validate = useCallback((data: YourItemPayload): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!data.title.trim()) {
      errors.push({ field: 'title', message: 'Title is required' });
    }
    return errors;
  }, []);

  const saveYourItem = useCallback(
    async (raw: YourItemPayload): Promise<boolean> => {
      const payload: YourItemPayload = {
        title: raw.title.trim(),
        description: raw.description?.trim() ? raw.description.trim() : null,
      };
      const errors = validate(payload);
      setValidationErrors(errors);
      if (errors.length > 0) {
        return false;
      }

      try {
        setIsSaving(true);
        if (currentYourItem) {
          const saved = await templateApi.updateItem(currentYourItem.id, payload);
          setYourItems((prev) => prev.map((i) => (i.id === currentYourItem.id ? saved : i)));
          setCurrentYourItem(saved);
          setPanelMode('view');
        } else {
          const saved = await templateApi.createItem(payload);
          setYourItems((prev) => [saved, ...prev]);
          closeYourItemsPanel();
        }
        clearValidationErrors();
        return true;
      } catch (err) {
        const error = err as { errors?: ValidationError[] };
        console.error('Failed to save your-item:', err);
        if (Array.isArray(error.errors)) {
          setValidationErrors(error.errors);
        } else {
          setValidationErrors([{ field: 'general', message: 'Failed to save. Please try again.' }]);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [clearValidationErrors, closeYourItemsPanel, currentYourItem, setValidationErrors, validate],
  );

  const deleteYourItem = useCallback(
    async (id: string) => {
      try {
        await templateApi.deleteItem(id);
        setYourItems((prev) => prev.filter((i) => i.id !== id));
        if (currentYourItem?.id === id) {
          closeYourItemsPanel();
        }
      } catch (err) {
        console.error('Failed to delete your-item:', err);
      }
    },
    [closeYourItemsPanel, currentYourItem?.id],
  );

  const value = useMemo<YourItemsContextType>(
    () => ({
      isYourItemsPanelOpen,
      currentYourItem,
      panelMode,
      validationErrors,
      yourItems,
      yourItemsContentView,
      isSaving,
      openYourItemsPanel,
      openYourItemForEdit,
      openYourItemForView,
      openYourItemsSettings,
      closeYourItemsSettingsView,
      closeYourItemsPanel,
      saveYourItem,
      deleteYourItem,
      clearValidationErrors,
    }),
    [
      isYourItemsPanelOpen,
      currentYourItem,
      panelMode,
      validationErrors,
      yourItems,
      yourItemsContentView,
      isSaving,
      openYourItemsPanel,
      openYourItemForEdit,
      openYourItemForView,
      openYourItemsSettings,
      closeYourItemsSettingsView,
      closeYourItemsPanel,
      saveYourItem,
      deleteYourItem,
      clearValidationErrors,
    ],
  );

  return <YourItemsContext.Provider value={value}>{children}</YourItemsContext.Provider>;
}
