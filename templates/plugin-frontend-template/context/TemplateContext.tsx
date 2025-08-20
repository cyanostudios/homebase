// templates/plugin-frontend-template/context/TemplateContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { TemplateApi, templateApi } from '../api/templateApi';
import { useApp } from '@/core/api/AppContext';

// TODO: Replace "your-items" with your plugin's plural-kebab name everywhere in this file.
// TODO: Replace YourItem with your domain model name (singular), e.g., Product, Article, etc.

export type ValidationError = { field: string; message: string };

export interface YourItem {
  id: string;
  // TODO: add your canonical fields here
  title?: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

interface YourItemsContextType {
  // Panel State
  isYourItemsPanelOpen: boolean;
  currentYourItem: YourItem | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];

  // Data
  yourItems: YourItem[];

  // Actions
  openYourItemsPanel: (item: YourItem | null) => void;
  openYourItemForEdit: (item: YourItem) => void;
  openYourItemForView: (item: YourItem) => void;
  closeYourItemsPanel: () => void;
  saveYourItem: (data: any) => Promise<boolean>;
  deleteYourItem: (id: string) => Promise<void>;
  clearValidationErrors: () => void;
}

const YourItemsContext = createContext<YourItemsContextType | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
  api?: TemplateApi; // for test injection
}

export function YourItemsProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
  api = templateApi,
}: ProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  // Panel
  const [isYourItemsPanelOpen, setIsYourItemsPanelOpen] = useState(false);
  const [currentYourItem, setCurrentYourItem] = useState<YourItem | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Data
  const [yourItems, setYourItems] = useState<YourItem[]>([]);

  // Load when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadItems();
    } else {
      setYourItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Register panel close once
  useEffect(() => {
    registerPanelCloseFunction('your-items', closeYourItemsPanel);
    return () => unregisterPanelCloseFunction('your-items');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global submit/cancel (PLURAL)
  useEffect(() => {
    (window as any).submitYourItemsForm = () => {
      const event = new CustomEvent('submitYourItemForm');
      window.dispatchEvent(event);
    };
    (window as any).cancelYourItemsForm = () => {
      const event = new CustomEvent('cancelYourItemForm');
      window.dispatchEvent(event);
    };
    return () => {
      delete (window as any).submitYourItemsForm;
      delete (window as any).cancelYourItemsForm;
    };
  }, []);

  const loadItems = async () => {
    try {
      const items = await api.getItems();
      const normalized = items.map((it: any) => ({
        ...it,
        createdAt: it.createdAt ? new Date(it.createdAt) : null,
        updatedAt: it.updatedAt ? new Date(it.updatedAt) : null,
      }));
      setYourItems(normalized);
    } catch (err) {
      console.error('Failed to load your-items:', err);
    }
  };

  // TODO: implement domain validation
  const validate = (_data: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    // Example:
    // if (!(_data.title || '').trim()) errors.push({ field: 'title', message: 'Title is required' });
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

  const closeYourItemsPanel = () => {
    setIsYourItemsPanelOpen(false);
    setCurrentYourItem(null);
    setPanelMode('create');
    setValidationErrors([]);
  };

  const clearValidationErrors = () => setValidationErrors([]);

  const saveYourItem = async (raw: any): Promise<boolean> => {
    const errors = validate(raw);
    setValidationErrors(errors);
    const blocking = errors.filter(e => !e.message.includes('Warning'));
    if (blocking.length > 0) return false;

    try {
      if (currentYourItem) {
        const saved = await api.updateItem((currentYourItem as any).id, raw);
        const normalized = {
          ...saved,
          createdAt: saved.createdAt ? new Date(saved.createdAt) : null,
          updatedAt: saved.updatedAt ? new Date(saved.updatedAt) : null,
        };
        setYourItems(prev => prev.map(i => (i.id === (currentYourItem as any).id ? normalized : i)));
        setCurrentYourItem(normalized as any);
        setPanelMode('view');
        setValidationErrors([]);
      } else {
        const saved = await api.createItem(raw);
        const normalized = {
          ...saved,
          createdAt: saved.createdAt ? new Date(saved.createdAt) : null,
          updatedAt: saved.updatedAt ? new Date(saved.updatedAt) : null,
        };
        setYourItems(prev => [...prev, normalized]);
        closeYourItemsPanel();
      }
      return true;
    } catch (err: any) {
      console.error('Failed to save your-item:', err);
      if (err?.status === 409 && Array.isArray(err.errors)) {
        setValidationErrors(err.errors);
      } else {
        setValidationErrors([{ field: 'general', message: 'Failed to save. Please try again.' }]);
      }
      return false;
    }
  };

  const deleteYourItem = async (id: string) => {
    try {
      await api.deleteItem(id);
      setYourItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      console.error('Failed to delete your-item:', err);
    }
  };

  const value: YourItemsContextType = {
    isYourItemsPanelOpen,
    currentYourItem,
    panelMode,
    validationErrors,
    yourItems,
    openYourItemsPanel,
    openYourItemForEdit,
    openYourItemForView,
    closeYourItemsPanel,
    saveYourItem,
    deleteYourItem,
    clearValidationErrors,
  };

  return <YourItemsContext.Provider value={value}>{children}</YourItemsContext.Provider>;
}

export function useYourItemsContext() {
  const ctx = useContext(YourItemsContext);
  if (!ctx) throw new Error('useYourItemsContext must be used within a YourItemsProvider');
  return ctx;
}
