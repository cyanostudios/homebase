// templates/plugin-frontend-template/context/TemplateContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useApp } from '@/core/api/AppContext';
import { templateApi } from '../api/templateApi';
import type {
  PanelMode,
  ValidationError,
  YourItem,
  YourItemPayload,
  YourItemsSettings,
} from '../types/your-items';

// TODO: Replace "your-items" with your plugin's plural-kebab name everywhere in this file.
// TODO: Replace YourItem with your domain model name (singular), e.g., Product, Article, etc.

interface YourItemsContextType {
  isYourItemsPanelOpen: boolean;
  currentYourItem: YourItem | null;
  panelMode: PanelMode;
  validationErrors: ValidationError[];
  yourItems: YourItem[];
  settings: YourItemsSettings | null;
  isSaving: boolean;
  openYourItemsPanel: (item: YourItem | null) => void;
  openYourItemForEdit: (item: YourItem) => void;
  openYourItemForView: (item: YourItem) => void;
  openYourItemsSettings: () => void;
  closeYourItemsPanel: () => void;
  saveYourItem: (data: YourItemPayload) => Promise<boolean>;
  deleteYourItem: (id: string) => Promise<void>;
  saveSettings: (data: YourItemsSettings) => Promise<boolean>;
  clearValidationErrors: () => void;
}

const YourItemsContext = createContext<YourItemsContextType | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function YourItemsProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: ProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  const [isYourItemsPanelOpen, setIsYourItemsPanelOpen] = useState(false);
  const [currentYourItem, setCurrentYourItem] = useState<YourItem | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [yourItems, setYourItems] = useState<YourItem[]>([]);
  const [settings, setSettings] = useState<YourItemsSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      void loadItems();
      void loadSettings();
    } else {
      setYourItems([]);
      setSettings(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    registerPanelCloseFunction('your-items', closeYourItemsPanel);
    return () => unregisterPanelCloseFunction('your-items');
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const items = await templateApi.getItems();
      setYourItems(items);
    } catch (err) {
      console.error('Failed to load your-items:', err);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const result = await templateApi.getSettings();
      setSettings(result);
    } catch (err) {
      console.error('Failed to load your-items settings:', err);
    }
  }, []);

  const validate = (data: YourItemPayload): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!data.title.trim()) {
      errors.push({ field: 'title', message: 'Title is required' });
    }
    return errors;
  };

  // Actions
  const openYourItemsPanel = (item: YourItem | null) => {
    setCurrentYourItem(item);
    setPanelMode(item ? 'edit' : 'create');
    setIsYourItemsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openYourItemForEdit = (item: YourItem) => {
    setCurrentYourItem(item);
    setPanelMode('edit');
    setIsYourItemsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openYourItemForView = (item: YourItem) => {
    setCurrentYourItem(item);
    setPanelMode('view');
    setIsYourItemsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openYourItemsSettings = () => {
    setCurrentYourItem(null);
    setPanelMode('settings');
    setIsYourItemsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const closeYourItemsPanel = () => {
    setIsYourItemsPanelOpen(false);
    setCurrentYourItem(null);
    setPanelMode('create');
    setValidationErrors([]);
  };

  const clearValidationErrors = useCallback(() => setValidationErrors([]), []);

  const saveYourItem = async (raw: YourItemPayload): Promise<boolean> => {
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
      setValidationErrors([]);
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
  };

  const deleteYourItem = async (id: string) => {
    try {
      await templateApi.deleteItem(id);
      setYourItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error('Failed to delete your-item:', err);
    }
  };

  const saveSettings = async (data: YourItemsSettings): Promise<boolean> => {
    try {
      setIsSaving(true);
      const saved = await templateApi.saveSettings(data);
      setSettings(saved);
      setValidationErrors([]);
      return true;
    } catch (err) {
      console.error('Failed to save your-items settings:', err);
      setValidationErrors([{ field: 'general', message: 'Failed to save settings.' }]);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const value: YourItemsContextType = {
    isYourItemsPanelOpen,
    currentYourItem,
    panelMode,
    validationErrors,
    yourItems,
    settings,
    isSaving,
    openYourItemsPanel,
    openYourItemForEdit,
    openYourItemForView,
    openYourItemsSettings,
    closeYourItemsPanel,
    saveYourItem,
    deleteYourItem,
    saveSettings,
    clearValidationErrors,
  };

  return <YourItemsContext.Provider value={value}>{children}</YourItemsContext.Provider>;
}

export function useYourItemsContext() {
  const ctx = useContext(YourItemsContext);
  if (!ctx) throw new Error('useYourItemsContext must be used within a YourItemsProvider');
  return ctx;
}
