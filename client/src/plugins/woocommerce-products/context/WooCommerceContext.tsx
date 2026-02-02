import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from 'react';

import { useApp } from '@/core/api/AppContext';

import { woocommerceApi } from '../api/woocommerceApi';
import type { WooSettings, WooTestResult, WooExportResult, MvpProduct, ValidationError } from '../types/woocommerce';

interface WooContextType {
  // Panel state
  isWoocommerceProductsPanelOpen: boolean;
  isWooCommercePanelOpen: boolean; // Alias for compatibility
  currentWooSettings: WooSettings | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];

  // Extra state
  isSaving: boolean;
  isTesting: boolean;
  exporting: boolean;
  lastTestResult: WooTestResult | null;
  lastExportResult: WooExportResult | null;

  // Actions
  openWooSettingsPanel: (settings: WooSettings | null) => void;
  openWooSettingsForEdit: (settings: WooSettings) => void;
  openWooSettingsForView: (settings: WooSettings) => void;
  closeWooSettingsPanel: () => void;
  closeWooCommercePanel: () => void; // Alias for generic handlers

  loadWooSettings: () => Promise<void>;
  saveWooSettings: (data: Partial<WooSettings>) => Promise<boolean>;
  saveWooCommerce: (data: any) => Promise<boolean>; // Alias for generic handlers
  testWooConnection: (override?: Partial<WooSettings>) => Promise<void>;
  exportProducts: (products: MvpProduct[]) => Promise<boolean>;
  clearValidationErrors: () => void;
  deleteWooCommerce: (_id: string) => Promise<void>; // Required by interface

  // Data
  settings: WooSettings | null;

  // Panel Title Functions
  getPanelTitle: (mode: string, item: WooSettings | null, isMobileView: boolean) => any;
  getPanelSubtitle: (mode: string, item: WooSettings | null) => any;
  getDeleteMessage: (item: WooSettings | null) => string;
}

const WooContext = createContext<WooContextType | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function WooCommerceProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: ProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  // Panel + form
  const [isWoocommerceProductsPanelOpen, setIsWoocommerceProductsPanelOpen] = useState(false);
  const isWooCommercePanelOpen = isWoocommerceProductsPanelOpen; // Alias
  const [currentWooSettings, setCurrentWooSettings] = useState<WooSettings | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Use refs to track panel state without causing dependency loops
  const panelStateRef = useRef({ isOpen: false, mode: 'create' as const, currentSettings: null as WooSettings | null });
  
  // Keep refs in sync with state
  useEffect(() => {
    panelStateRef.current = {
      isOpen: isWoocommerceProductsPanelOpen,
      mode: panelMode,
      currentSettings: currentWooSettings,
    };
  }, [isWoocommerceProductsPanelOpen, panelMode, currentWooSettings]);

  // Data
  const [settings, setSettings] = useState<WooSettings | null>(null);

  // Ops state
  const [isTesting, setIsTesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<WooTestResult | null>(null);
  const [lastExportResult, setLastExportResult] = useState<WooExportResult | null>(null);

  // Stable helpers
  const clearValidationErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  const loadWooSettings = useCallback(async () => {
    try {
      const s = await woocommerceApi.getSettings();
      const normalized: WooSettings | null = s
        ? {
            ...s,
            createdAt: s.createdAt ? new Date(s.createdAt) : null,
            updatedAt: s.updatedAt ? new Date(s.updatedAt) : null,
          }
        : null;
      setSettings(normalized);
      // Only update currentWooSettings if:
      // 1. Panel is not open in create mode with null currentSettings
      // 2. We're not viewing a specific instance (instance with numeric ID)
      // This prevents overwriting currentWooSettings when user is creating a new store
      // or viewing/editing a specific instance
      const { isOpen, mode, currentSettings } = panelStateRef.current;
      const isViewingSpecificInstance = currentSettings?.id && /^\d+$/.test(String(currentSettings.id));
      if (!(isOpen && mode === 'create' && currentSettings === null) && !isViewingSpecificInstance) {
        setCurrentWooSettings(normalized);
      }
    } catch (err) {
      console.error('Failed to load Woo settings:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load settings when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadWooSettings();
    } else {
      setSettings(null);
    }
  }, [isAuthenticated, loadWooSettings]);

  // Register panel close hook in global app
  useEffect(() => {
    registerPanelCloseFunction('woocommerce-products', closeWooSettingsPanel);
    return () => unregisterPanelCloseFunction('woocommerce-products');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose global submit/cancel
  useEffect(() => {
    (window as any).submitWoocommerceProductsForm = () => {
      const ev = new CustomEvent('submitWooSettingsForm');
      window.dispatchEvent(ev);
    };
    (window as any).cancelWoocommerceProductsForm = () => {
      const ev = new CustomEvent('cancelWooSettingsForm');
      window.dispatchEvent(ev);
    };
    return () => {
      delete (window as any).submitWoocommerceProductsForm;
      delete (window as any).cancelWoocommerceProductsForm;
    };
  }, []);

  const validate = (data: Partial<WooSettings>): ValidationError[] => {
    const errs: ValidationError[] = [];
    const url = String(data.storeUrl ?? '').trim();
    const ck = String(data.consumerKey ?? '').trim();
    const cs = String(data.consumerSecret ?? '').trim();
    if (!url) {
      errs.push({ field: 'storeUrl', message: 'Store URL is required' });
    }
    if (!ck) {
      errs.push({ field: 'consumerKey', message: 'Consumer key is required' });
    }
    if (!cs) {
      errs.push({ field: 'consumerSecret', message: 'Consumer secret is required' });
    }
    return errs;
  };

  const saveWooSettings = async (raw: Partial<WooSettings & { instanceKey?: string }>): Promise<boolean> => {
    const errs = validate(raw);
    setValidationErrors(errs);
    if (errs.length) {
      return false;
    }
    setIsSaving(true);
    try {
      let saved: WooSettings;
      
      // If we have an instance ID (from editing an existing instance), use updateInstance
      if (raw.id && /^\d+$/.test(String(raw.id))) {
        // This is an instance ID, use updateInstance
        const instanceId = String(raw.id);
        const result = await woocommerceApi.updateInstance(instanceId, {
          storeUrl: String(raw.storeUrl),
          consumerKey: String(raw.consumerKey),
          consumerSecret: String(raw.consumerSecret),
          useQueryAuth: !!raw.useQueryAuth,
          label: (raw as any).label || undefined,
        });
        saved = {
          id: result.instance.id,
          storeUrl: result.instance.credentials?.storeUrl || '',
          consumerKey: result.instance.credentials?.consumerKey || '',
          consumerSecret: result.instance.credentials?.consumerSecret || '',
          useQueryAuth: result.instance.credentials?.useQueryAuth || false,
          createdAt: result.instance.createdAt ? new Date(result.instance.createdAt) : null,
          updatedAt: result.instance.updatedAt ? new Date(result.instance.updatedAt) : null,
          label: result.instance.label || undefined,
          instanceKey: result.instance.instanceKey || undefined,
        } as any;
      } else if (panelMode === 'create' && currentWooSettings === null) {
        // Creating a new instance - generate instanceKey from store URL if not provided
        const instanceKey = raw.instanceKey || (() => {
          try {
            const url = new URL(String(raw.storeUrl));
            return url.hostname.replace(/\./g, '-').toLowerCase();
          } catch {
            return `store-${Date.now()}`;
          }
        })();
        const result = await woocommerceApi.createInstance({
          instanceKey,
          label: (raw as any).label || undefined,
          storeUrl: String(raw.storeUrl),
          consumerKey: String(raw.consumerKey),
          consumerSecret: String(raw.consumerSecret),
          useQueryAuth: !!raw.useQueryAuth,
        });
        saved = {
          id: result.instance.id,
          storeUrl: result.instance.credentials?.storeUrl || '',
          consumerKey: result.instance.credentials?.consumerKey || '',
          consumerSecret: result.instance.credentials?.consumerSecret || '',
          useQueryAuth: result.instance.credentials?.useQueryAuth || false,
          createdAt: result.instance.createdAt ? new Date(result.instance.createdAt) : null,
          updatedAt: result.instance.updatedAt ? new Date(result.instance.updatedAt) : null,
          label: result.instance.label || undefined,
          instanceKey: result.instance.instanceKey || undefined,
        } as any;
      } else if (raw.instanceKey && raw.instanceKey !== 'default') {
        // Creating a new instance with explicit instanceKey
        const result = await woocommerceApi.createInstance({
          instanceKey: raw.instanceKey,
          label: (raw as any).label || undefined,
          storeUrl: String(raw.storeUrl),
          consumerKey: String(raw.consumerKey),
          consumerSecret: String(raw.consumerSecret),
          useQueryAuth: !!raw.useQueryAuth,
        });
        saved = {
          id: result.instance.id,
          storeUrl: result.instance.credentials?.storeUrl || '',
          consumerKey: result.instance.credentials?.consumerKey || '',
          consumerSecret: result.instance.credentials?.consumerSecret || '',
          useQueryAuth: result.instance.credentials?.useQueryAuth || false,
          createdAt: result.instance.createdAt ? new Date(result.instance.createdAt) : null,
          updatedAt: result.instance.updatedAt ? new Date(result.instance.updatedAt) : null,
          label: result.instance.label || undefined,
          instanceKey: result.instance.instanceKey || undefined,
        } as any;
      } else {
        // Default instance (backwards compatibility)
        saved = await woocommerceApi.putSettings({
          storeUrl: String(raw.storeUrl),
          consumerKey: String(raw.consumerKey),
          consumerSecret: String(raw.consumerSecret),
          useQueryAuth: !!raw.useQueryAuth,
        });
      }
      
      const normalized: WooSettings = {
        ...saved,
        createdAt: saved.createdAt ? new Date(saved.createdAt) : null,
        updatedAt: saved.updatedAt ? new Date(saved.updatedAt) : null,
      };
      
      // Update settings
      if (raw.id && /^\d+$/.test(String(raw.id))) {
        // This was an instance update - update settings but don't change currentWooSettings
        // since we're closing the panel anyway
      } else {
        // This was default instance - update both
        setSettings(normalized);
      }
      
      setValidationErrors([]);
      
      // WooCommerce has no View component, so close the panel after saving
      // This matches the behavior when canceling - user returns to the list
      closeWooSettingsPanel();
      
      // Reload settings to refresh instances list
      await loadWooSettings();
      
      return true;
    } catch (err: any) {
      console.error('Save Woo settings failed:', err);
      if (err?.status === 409 && Array.isArray(err.errors)) {
        setValidationErrors(err.errors);
      } else {
        setValidationErrors([
          { field: 'general', message: 'Failed to save settings. Please try again.' },
        ]);
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Alias for generic panel handlers compatibility
  const saveWooCommerce = saveWooSettings;

  const testWooConnection = async (override?: Partial<WooSettings>) => {
    setIsTesting(true);
    setLastTestResult(null);
    try {
      const body = override || {};
      const result = await woocommerceApi.testConnection({
        storeUrl: body.storeUrl ?? settings?.storeUrl,
        consumerKey: body.consumerKey ?? settings?.consumerKey,
        consumerSecret: body.consumerSecret ?? settings?.consumerSecret,
        useQueryAuth: body.useQueryAuth ?? settings?.useQueryAuth,
      });
      setLastTestResult(result as WooTestResult);
    } catch (err) {
      console.error('Test Woo connection failed:', err);
      setLastTestResult(null);
    } finally {
      setIsTesting(false);
    }
  };

  const exportProducts = async (products: MvpProduct[]): Promise<boolean> => {
    if (!Array.isArray(products) || products.length === 0) {
      setValidationErrors([
        { field: 'products', message: 'Select at least one product to export' },
      ]);
      return false;
    }
    setExporting(true);
    setLastExportResult(null);
    try {
      const res = await woocommerceApi.exportProducts(products as any[]);
      setLastExportResult(res as WooExportResult);
      return true;
    } catch (err) {
      console.error('Export to Woo failed:', err);
      setLastExportResult(null);
      setValidationErrors([
        { field: 'general', message: 'Export failed. See console for details.' },
      ]);
      return false;
    } finally {
      setExporting(false);
    }
  };

  // Panel actions
  const openWooSettingsPanel = (s: WooSettings | null) => {
    setCurrentWooSettings(s);
    setPanelMode(s ? 'view' : 'create');
    setIsWoocommerceProductsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };
  const openWooSettingsForEdit = (s: WooSettings) => {
    setCurrentWooSettings(s);
    setPanelMode('edit');
    setIsWoocommerceProductsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };
  const openWooSettingsForView = (s: WooSettings) => {
    setCurrentWooSettings(s);
    setPanelMode('view');
    setIsWoocommerceProductsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };
  const closeWooSettingsPanel = () => {
    setIsWoocommerceProductsPanelOpen(false);
    setCurrentWooSettings(null);
    setPanelMode('create');
    setValidationErrors([]);
  };

  // Alias for generic panel handlers compatibility
  const closeWooCommercePanel = closeWooSettingsPanel;

  const deleteWooCommerce = async (_id: string) => {
    // WooCommerce settings deletion not typically needed, but required by interface
    setValidationErrors([{ field: 'general', message: 'Delete not supported for WooCommerce settings' }]);
  };

  // Panel Title Functions
  const getPanelTitle = (mode: string, item: WooSettings | null, isMobileView: boolean) => {
    return 'WooCommerce Settings';
  };

  const getPanelSubtitle = (mode: string, item: WooSettings | null) => {
    return mode === 'edit' ? 'Update WooCommerce connection' : 'Configure WooCommerce connection';
  };

  const getDeleteMessage = (item: WooSettings | null) => {
    return 'Are you sure you want to delete WooCommerce settings? This action cannot be undone.';
  };

  const value: WooContextType = useMemo(
    () => ({
      isWoocommerceProductsPanelOpen,
      isWooCommercePanelOpen,
      currentWooSettings,
      panelMode,
      validationErrors,
      isSaving,
      isTesting,
      exporting,
      lastTestResult,
      lastExportResult,
      openWooSettingsPanel,
      openWooSettingsForEdit,
      openWooSettingsForView,
      closeWooSettingsPanel,
      closeWooCommercePanel,
      loadWooSettings,
      saveWooSettings,
      saveWooCommerce,
      testWooConnection,
      exportProducts,
      clearValidationErrors,
      deleteWooCommerce,
      settings,
      getPanelTitle,
      getPanelSubtitle,
      getDeleteMessage,
    }),
    [
      isWoocommerceProductsPanelOpen,
      currentWooSettings,
      panelMode,
      validationErrors,
      isSaving,
      isTesting,
      exporting,
      lastTestResult,
      lastExportResult,
      settings,
      loadWooSettings,
      clearValidationErrors,
    ],
  );

  return <WooContext.Provider value={value}>{children}</WooContext.Provider>;
}

export function useWooCommerce() {
  const ctx = useContext(WooContext);
  if (!ctx) {
    throw new Error('useWooCommerce must be used within WooCommerceProvider');
  }
  return ctx;
}
