import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useApp } from '@/core/api/AppContext';

import { fyndiqApi } from '../api/fyndiqApi';
import type {
  FyndiqExportResult,
  FyndiqSettings,
  FyndiqTestResult,
  ValidationError,
} from '../types/fyndiq';

interface FyndiqContextType {
  // Panel state
  isFyndiqProductsPanelOpen: boolean;
  currentFyndiqSettings: FyndiqSettings | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];

  // Extra state
  isSaving: boolean;
  isTesting: boolean;
  exporting: boolean;
  lastTestResult: FyndiqTestResult | null;
  lastExportResult: FyndiqExportResult | null;

  // Data
  settings: FyndiqSettings | null;

  // Actions
  openFyndiqSettingsPanel: (settings: FyndiqSettings | null) => void;
  openFyndiqSettingsForEdit: (settings: FyndiqSettings) => void;
  openFyndiqSettingsForView: (settings: FyndiqSettings) => void;
  closeFyndiqSettingsPanel: () => void;

  loadFyndiqSettings: () => Promise<void>;
  saveFyndiqSettings: (data: Partial<FyndiqSettings>) => Promise<boolean>;
  testFyndiqConnection: (override?: Partial<FyndiqSettings>) => Promise<void>;
  exportProducts: (products: any[]) => Promise<boolean>;
  clearValidationErrors: () => void;

  // Required by generic handlers (settings are not deletable in MVP)
  deleteFyndiqProduct: (_id: string) => Promise<void>;

  // ---- Dynamic handler compatibility aliases ----
  closeFyndiqProductPanel: () => void;
  openFyndiqProductForEdit: (item: any) => void;
  openFyndiqProductForView: (item: any) => void;
  saveFyndiqProduct: (data: any) => Promise<boolean>;
}

const FyndiqContext = createContext<FyndiqContextType | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function FyndiqProductsProvider({ children, isAuthenticated, onCloseOtherPanels }: ProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  const [isFyndiqProductsPanelOpen, setIsFyndiqProductsPanelOpen] = useState(false);
  const [currentFyndiqSettings, setCurrentFyndiqSettings] = useState<FyndiqSettings | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const [settings, setSettings] = useState<FyndiqSettings | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<FyndiqTestResult | null>(null);
  const [lastExportResult, setLastExportResult] = useState<FyndiqExportResult | null>(null);

  const clearValidationErrors = useCallback(() => setValidationErrors([]), []);

  const normalizeSettings = useCallback((s: FyndiqSettings | null): FyndiqSettings | null => {
    if (!s) return null;
    return {
      ...s,
      createdAt: s.createdAt ? new Date(s.createdAt) : null,
      updatedAt: s.updatedAt ? new Date(s.updatedAt) : null,
      apiKey: s.apiKey || '',
      apiSecret: s.apiSecret || '',
      connected: !!s.connected,
    };
  }, []);

  const loadFyndiqSettings = useCallback(async () => {
    try {
      const s = await fyndiqApi.getSettings();
      const normalized = normalizeSettings(s);
      setSettings(normalized);
      setCurrentFyndiqSettings(normalized);
    } catch (err) {
      console.error('Failed to load Fyndiq settings:', err);
    }
  }, [normalizeSettings]);

  const openFyndiqSettingsPanel = useCallback((s: FyndiqSettings | null) => {
    setCurrentFyndiqSettings(s);
    setPanelMode(s ? 'view' : 'create');
    setIsFyndiqProductsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  }, [onCloseOtherPanels]);

  const openFyndiqSettingsForEdit = useCallback((s: FyndiqSettings) => {
    setCurrentFyndiqSettings(s);
    setPanelMode('edit');
    setIsFyndiqProductsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  }, [onCloseOtherPanels]);

  const openFyndiqSettingsForView = useCallback((s: FyndiqSettings) => {
    setCurrentFyndiqSettings(s);
    setPanelMode('view');
    setIsFyndiqProductsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  }, [onCloseOtherPanels]);

  const closeFyndiqSettingsPanel = useCallback(() => {
    setIsFyndiqProductsPanelOpen(false);
    setCurrentFyndiqSettings(null);
    setPanelMode('create');
    setValidationErrors([]);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadFyndiqSettings();
    } else {
      setSettings(null);
      setCurrentFyndiqSettings(null);
    }
  }, [isAuthenticated, loadFyndiqSettings]);

  useEffect(() => {
    registerPanelCloseFunction('fyndiq-products', closeFyndiqSettingsPanel);
    return () => unregisterPanelCloseFunction('fyndiq-products');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose global submit/cancel
  useEffect(() => {
    (window as any).submitFyndiqProductsForm = () => {
      window.dispatchEvent(new CustomEvent('submitFyndiqSettingsForm'));
    };
    (window as any).cancelFyndiqProductsForm = () => {
      window.dispatchEvent(new CustomEvent('cancelFyndiqSettingsForm'));
    };
    return () => {
      delete (window as any).submitFyndiqProductsForm;
      delete (window as any).cancelFyndiqProductsForm;
    };
  }, []);

  const validate = (data: Partial<FyndiqSettings>): ValidationError[] => {
    const errs: ValidationError[] = [];
    const apiKey = String(data.apiKey ?? '').trim();
    const apiSecret = String(data.apiSecret ?? '').trim();
    if (!apiKey) errs.push({ field: 'apiKey', message: 'User is required' });
    if (!apiSecret) errs.push({ field: 'apiSecret', message: 'Password is required' });
    return errs;
  };

  const saveFyndiqSettings = useCallback(async (raw: Partial<FyndiqSettings>): Promise<boolean> => {
    const errs = validate(raw);
    setValidationErrors(errs);
    if (errs.length) return false;

    setIsSaving(true);
    try {
      const saved = await fyndiqApi.putSettings({
        apiKey: String(raw.apiKey || ''),
        apiSecret: String(raw.apiSecret || ''),
      });
      const normalized = normalizeSettings(saved) as FyndiqSettings;
      setSettings(normalized);
      setCurrentFyndiqSettings(normalized);
      setPanelMode('view');
      setValidationErrors([]);
      return true;
    } catch (err: any) {
      console.error('Save Fyndiq settings failed:', err);
      if (err?.status === 409 && Array.isArray(err.errors)) {
        setValidationErrors(err.errors);
      } else {
        setValidationErrors([{ field: 'general', message: 'Failed to save settings. Please try again.' }]);
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [normalizeSettings]);

  const testFyndiqConnection = useCallback(async (override?: Partial<FyndiqSettings>) => {
    setIsTesting(true);
    setLastTestResult(null);
    try {
      const body = override || {};
      const result = await fyndiqApi.testConnection({
        apiKey: body.apiKey ?? settings?.apiKey,
        apiSecret: body.apiSecret ?? settings?.apiSecret,
      });
      setLastTestResult(result as FyndiqTestResult);
    } catch (err) {
      console.error('Test Fyndiq connection failed:', err);
      setLastTestResult({ ok: false, error: 'Failed to test connection' });
    } finally {
      setIsTesting(false);
    }
  }, [settings]);

  const exportProducts = useCallback(async (products: any[]): Promise<boolean> => {
    if (!Array.isArray(products) || products.length === 0) {
      setValidationErrors([{ field: 'products', message: 'Select at least one product to export' }]);
      return false;
    }
    setExporting(true);
    setLastExportResult(null);
    try {
      const res = await fyndiqApi.exportProducts(products);
      setLastExportResult(res as FyndiqExportResult);
      return true;
    } catch (err) {
      console.error('Export to Fyndiq failed:', err);
      setLastExportResult(null);
      setValidationErrors([{ field: 'general', message: 'Export failed. See console for details.' }]);
      return false;
    } finally {
      setExporting(false);
    }
  }, []);

  const deleteFyndiqProduct = useCallback(async (_id: string) => {
    setValidationErrors([
      { field: 'general', message: 'Delete not supported for Fyndiq settings' },
    ]);
  }, []);

  // ---- aliases expected by generic panel handlers ----
  const closeFyndiqProductPanel = useCallback(() => closeFyndiqSettingsPanel(), [closeFyndiqSettingsPanel]);
  const openFyndiqProductForEdit = useCallback(
    (item: any) => openFyndiqSettingsForEdit(item as FyndiqSettings),
    [openFyndiqSettingsForEdit],
  );
  const openFyndiqProductForView = useCallback(
    (item: any) => openFyndiqSettingsForView(item as FyndiqSettings),
    [openFyndiqSettingsForView],
  );
  const saveFyndiqProduct = useCallback((data: any) => saveFyndiqSettings(data), [saveFyndiqSettings]);

  const value: FyndiqContextType = useMemo(
    () => ({
      isFyndiqProductsPanelOpen,
      currentFyndiqSettings,
      panelMode,
      validationErrors,
      isSaving,
      isTesting,
      exporting,
      lastTestResult,
      lastExportResult,
      settings,
      openFyndiqSettingsPanel,
      openFyndiqSettingsForEdit,
      openFyndiqSettingsForView,
      closeFyndiqSettingsPanel,
      loadFyndiqSettings,
      saveFyndiqSettings,
      testFyndiqConnection,
      exportProducts,
      clearValidationErrors,
      deleteFyndiqProduct,
      closeFyndiqProductPanel,
      openFyndiqProductForEdit,
      openFyndiqProductForView,
      saveFyndiqProduct,
    }),
    [
      isFyndiqProductsPanelOpen,
      currentFyndiqSettings,
      panelMode,
      validationErrors,
      isSaving,
      isTesting,
      exporting,
      lastTestResult,
      lastExportResult,
      settings,
      openFyndiqSettingsPanel,
      openFyndiqSettingsForEdit,
      openFyndiqSettingsForView,
      closeFyndiqSettingsPanel,
      loadFyndiqSettings,
      saveFyndiqSettings,
      testFyndiqConnection,
      exportProducts,
      clearValidationErrors,
      deleteFyndiqProduct,
      closeFyndiqProductPanel,
      openFyndiqProductForEdit,
      openFyndiqProductForView,
      saveFyndiqProduct,
    ],
  );

  return <FyndiqContext.Provider value={value}>{children}</FyndiqContext.Provider>;
}

export function useFyndiqProducts() {
  const ctx = useContext(FyndiqContext);
  if (!ctx) throw new Error('useFyndiqProducts must be used within FyndiqProductsProvider');
  return ctx;
}

