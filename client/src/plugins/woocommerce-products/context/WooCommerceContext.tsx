import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
  useCallback, // ← NEW
} from 'react';
import { useApp } from '@/core/api/AppContext';
import { woocommerceApi } from '../api/woocommerceApi';
import type { WooSettings, WooTestResult, WooExportResult, MvpProduct } from '../types/woocommerce';

export type ValidationError = { field: string; message: string };

interface WooContextType {
  // Panel state
  isWooSettingsPanelOpen: boolean;
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

  loadWooSettings: () => Promise<void>;
  saveWooSettings: (data: Partial<WooSettings>) => Promise<boolean>;
  testWooConnection: (override?: Partial<WooSettings>) => Promise<void>;
  exportProducts: (products: MvpProduct[]) => Promise<boolean>;
  clearValidationErrors: () => void;

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
  // test injection seam
  api?: typeof woocommerceApi;
}

export function WooCommerceProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
  api = woocommerceApi,
}: ProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  // Panel + form
  const [isWooSettingsPanelOpen, setIsWooSettingsPanelOpen] = useState(false);
  const [currentWooSettings, setCurrentWooSettings] = useState<WooSettings | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Data
  const [settings, setSettings] = useState<WooSettings | null>(null);

  // Ops state
  const [isTesting, setIsTesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<WooTestResult | null>(null);
  const [lastExportResult, setLastExportResult] = useState<WooExportResult | null>(null);

  // ====== STABLE HELPERS (fix render loop) ======
  const clearValidationErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  const loadWooSettings = useCallback(async () => {
    try {
      const s = await api.getSettings();
      const normalized: WooSettings | null = s
        ? {
            ...s,
            createdAt: s.createdAt ? new Date(s.createdAt) : null,
            updatedAt: s.updatedAt ? new Date(s.updatedAt) : null,
          }
        : null;
      setSettings(normalized);
      setCurrentWooSettings(normalized);
    } catch (err) {
      console.error('Failed to load Woo settings:', err);
    }
  }, [api]);
  // ==============================================

  // Load settings when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadWooSettings();
    } else {
      setSettings(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Register panel close hook in global app
  useEffect(() => {
    registerPanelCloseFunction('woocommerce-products', closeWooSettingsPanel);
    return () => unregisterPanelCloseFunction('woocommerce-products');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose global submit/cancel
  useEffect(() => {
    (window as any).submitWooSettingsForm = () => {
      const ev = new CustomEvent('submitWooSettingsForm');
      window.dispatchEvent(ev);
    };
    (window as any).cancelWooSettingsForm = () => {
      const ev = new CustomEvent('cancelWooSettingsForm');
      window.dispatchEvent(ev);
    };
    return () => {
      delete (window as any).submitWooSettingsForm;
      delete (window as any).cancelWooSettingsForm;
    };
  }, []);

  const validate = (data: Partial<WooSettings>): ValidationError[] => {
    const errs: ValidationError[] = [];
    const url = String(data.storeUrl ?? '').trim();
    const ck = String(data.consumerKey ?? '').trim();
    const cs = String(data.consumerSecret ?? '').trim();
    if (!url) errs.push({ field: 'storeUrl', message: 'Store URL is required' });
    if (!ck) errs.push({ field: 'consumerKey', message: 'Consumer key is required' });
    if (!cs) errs.push({ field: 'consumerSecret', message: 'Consumer secret is required' });
    return errs;
  };

  const saveWooSettings = async (raw: Partial<WooSettings>): Promise<boolean> => {
    const errs = validate(raw);
    setValidationErrors(errs);
    if (errs.length) return false;
    setIsSaving(true);
    try {
      const saved = await api.putSettings({
        storeUrl: String(raw.storeUrl),
        consumerKey: String(raw.consumerKey),
        consumerSecret: String(raw.consumerSecret),
        useQueryAuth: !!raw.useQueryAuth,
      });
      const normalized: WooSettings = {
        ...saved,
        createdAt: saved.createdAt ? new Date(saved.createdAt) : null,
        updatedAt: saved.updatedAt ? new Date(saved.updatedAt) : null,
      };
      setSettings(normalized);
      setCurrentWooSettings(normalized);
      setPanelMode('view');
      setValidationErrors([]);
      return true;
    } catch (err: any) {
      console.error('Save Woo settings failed:', err);
      if (err?.status === 409 && Array.isArray(err.errors)) {
        setValidationErrors(err.errors);
      } else {
        setValidationErrors([{ field: 'general', message: 'Failed to save settings. Please try again.' }]);
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Alias for generic panel handlers compatibility
  const saveWoocommerceProduct = saveWooSettings;

  const testWooConnection = async (override?: Partial<WooSettings>) => {
    setIsTesting(true);
    setLastTestResult(null);
    try {
      const body = override || {};
      const result = await api.testConnection({
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
      setValidationErrors([{ field: 'products', message: 'Select at least one product to export' }]);
      return false;
    }
    setExporting(true);
    setLastExportResult(null);
    try {
      const res = await api.exportProducts(products as any[]);
      setLastExportResult(res as WooExportResult);
      return true;
    } catch (err) {
      console.error('Export to Woo failed:', err);
      setLastExportResult(null);
      setValidationErrors([{ field: 'general', message: 'Export failed. See console for details.' }]);
      return false;
    } finally {
      setExporting(false);
    }
  };

  // Panel actions
  const openWooSettingsPanel = (s: WooSettings | null) => {
    setCurrentWooSettings(s);
    setPanelMode(s ? 'view' : 'create');
    setIsWooSettingsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };
  const openWooSettingsForEdit = (s: WooSettings) => {
    setCurrentWooSettings(s);
    setPanelMode('edit');
    setIsWooSettingsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };
  const openWooSettingsForView = (s: WooSettings) => {
    setCurrentWooSettings(s);
    setPanelMode('view');
    setIsWooSettingsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };
  const closeWooSettingsPanel = () => {
    setIsWooSettingsPanelOpen(false);
    setCurrentWooSettings(null);
    setPanelMode('create');
    setValidationErrors([]);
  };

  // Panel Title Functions
  const getPanelTitle = (mode: string, item: WooSettings | null, isMobileView: boolean) => {
    return 'WooCommerce Settings';
  };

  const getPanelSubtitle = (mode: string, item: WooSettings | null) => {
    return mode === 'edit'
      ? 'Update WooCommerce connection'
      : 'Configure WooCommerce connection';
  };

  const getDeleteMessage = (item: WooSettings | null) => {
    return 'Are you sure you want to delete WooCommerce settings? This action cannot be undone.';
  };

  const value: WooContextType = useMemo(() => ({
    isWooSettingsPanelOpen,
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
    loadWooSettings,          // ← stable
    saveWooSettings,
    saveWoocommerceProduct,  // Alias for generic handlers
    testWooConnection,
    exportProducts,
    clearValidationErrors,    // ← stable
    settings,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
  }), [
    isWooSettingsPanelOpen,
    currentWooSettings,
    panelMode,
    validationErrors,
    isSaving,
    isTesting,
    exporting,
    lastTestResult,
    lastExportResult,
    settings,
    loadWooSettings,          // include stable fns in memo
    clearValidationErrors,
  ]);

  return <WooContext.Provider value={value}>{children}</WooContext.Provider>;
}

export function useWooCommerce() {
  const ctx = useContext(WooContext);
  if (!ctx) throw new Error('useWooCommerce must be used within WooCommerceProvider');
  return ctx;
}