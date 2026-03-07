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

import { cdonApi } from '../api/cdonApi';
import type {
  CdonExportResult,
  CdonSettings,
  CdonTestResult,
  ValidationError,
} from '../types/cdon';

interface CdonContextType {
  // Panel state
  isCdonProductsPanelOpen: boolean;
  currentCdonSettings: CdonSettings | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];

  // Extra state
  isSaving: boolean;
  isTesting: boolean;
  exporting: boolean;
  lastTestResult: CdonTestResult | null;
  lastExportResult: CdonExportResult | null;

  // Data
  settings: CdonSettings | null;

  // Actions
  openCdonSettingsPanel: (settings: CdonSettings | null) => void;
  openCdonSettingsForEdit: (settings: CdonSettings) => void;
  openCdonSettingsForView: (settings: CdonSettings) => void;
  closeCdonSettingsPanel: () => void;

  loadCdonSettings: () => Promise<void>;
  saveCdonSettings: (data: Partial<CdonSettings>) => Promise<boolean>;
  testCdonConnection: (override?: Partial<CdonSettings>) => Promise<void>;
  exportProducts: (products: any[]) => Promise<boolean>;
  clearValidationErrors: () => void;

  // Required by generic handlers (settings are not deletable in MVP)
  deleteCdonProduct: (_id: string) => Promise<void>;

  // ---- Dynamic handler compatibility aliases ----
  // panelHandlers.ts expects singularCap('cdon-products') -> 'CdonProduct'
  closeCdonProductPanel: () => void;
  openCdonProductForEdit: (item: any) => void;
  openCdonProductForView: (item: any) => void;
  saveCdonProduct: (data: any) => Promise<boolean>;
}

const CdonContext = createContext<CdonContextType | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function CdonProductsProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: ProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  const [isCdonProductsPanelOpen, setIsCdonProductsPanelOpen] = useState(false);
  const [currentCdonSettings, setCurrentCdonSettings] = useState<CdonSettings | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const [settings, setSettings] = useState<CdonSettings | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<CdonTestResult | null>(null);
  const [lastExportResult, setLastExportResult] = useState<CdonExportResult | null>(null);

  const clearValidationErrors = useCallback(() => setValidationErrors([]), []);

  const normalizeSettings = useCallback((s: CdonSettings | null): CdonSettings | null => {
    if (!s) {
      return null;
    }
    return {
      ...s,
      createdAt: s.createdAt ? new Date(s.createdAt) : null,
      updatedAt: s.updatedAt ? new Date(s.updatedAt) : null,
      apiKey: s.apiKey || '',
      apiSecret: s.apiSecret || '',
      connected: !!s.connected,
    };
  }, []);

  const loadCdonSettings = useCallback(async () => {
    try {
      const s = await cdonApi.getSettings();
      const normalized = normalizeSettings(s);
      setSettings(normalized);
      setCurrentCdonSettings(normalized);
    } catch (err) {
      console.error('Failed to load CDON settings:', err);
    }
  }, [normalizeSettings]);

  // Panel actions
  const openCdonSettingsPanel = useCallback(
    (s: CdonSettings | null) => {
      setCurrentCdonSettings(s);
      setPanelMode(s ? 'edit' : 'create');
      setIsCdonProductsPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openCdonSettingsForEdit = useCallback(
    (s: CdonSettings) => {
      setCurrentCdonSettings(s);
      setPanelMode('edit');
      setIsCdonProductsPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openCdonSettingsForView = useCallback(
    (s: CdonSettings) => {
      setCurrentCdonSettings(s);
      setPanelMode('edit');
      setIsCdonProductsPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const closeCdonSettingsPanel = useCallback(() => {
    setIsCdonProductsPanelOpen(false);
    setCurrentCdonSettings(null);
    setPanelMode('create');
    setValidationErrors([]);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadCdonSettings();
    } else {
      setSettings(null);
      setCurrentCdonSettings(null);
    }
  }, [isAuthenticated, loadCdonSettings]);

  // Register panel close for generic panel system
  useEffect(() => {
    registerPanelCloseFunction('cdon-products', closeCdonSettingsPanel);
    return () => unregisterPanelCloseFunction('cdon-products');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose global submit/cancel (must match PanelFooter naming pattern)
  useEffect(() => {
    (window as any).submitCdonProductsForm = () => {
      window.dispatchEvent(new CustomEvent('submitCdonSettingsForm'));
    };
    (window as any).cancelCdonProductsForm = () => {
      window.dispatchEvent(new CustomEvent('cancelCdonSettingsForm'));
    };
    return () => {
      delete (window as any).submitCdonProductsForm;
      delete (window as any).cancelCdonProductsForm;
    };
  }, []);

  const validate = (data: Partial<CdonSettings>): ValidationError[] => {
    const errs: ValidationError[] = [];
    const apiKey = String(data.apiKey ?? '').trim();
    const apiSecret = String(data.apiSecret ?? '').trim();
    if (!apiKey) {
      errs.push({ field: 'apiKey', message: 'Username is required' });
    }
    if (!apiSecret) {
      errs.push({ field: 'apiSecret', message: 'Password is required' });
    }
    return errs;
  };

  const saveCdonSettings = useCallback(
    async (raw: Partial<CdonSettings>): Promise<boolean> => {
      const errs = validate(raw);
      setValidationErrors(errs);
      if (errs.length) {
        return false;
      }

      setIsSaving(true);
      try {
        const saved = await cdonApi.putSettings({
          apiKey: String(raw.apiKey || ''),
          apiSecret: String(raw.apiSecret || ''),
        });
        const normalized = normalizeSettings(saved) as CdonSettings;
        setSettings(normalized);
        setCurrentCdonSettings(normalized);
        setPanelMode('view');
        setValidationErrors([]);
        return true;
      } catch (err: any) {
        console.error('Save CDON settings failed:', err);
        if (err?.status === 409 && Array.isArray(err.errors)) {
          setValidationErrors(err.errors);
        } else {
          const message =
            err?.message || err?.error || 'Failed to save settings. Please try again.';
          setValidationErrors([{ field: 'general', message }]);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [normalizeSettings],
  );

  const testCdonConnection = useCallback(
    async (override?: Partial<CdonSettings>) => {
      setIsTesting(true);
      setLastTestResult(null);
      try {
        const body = override || {};
        const result = await cdonApi.testConnection({
          apiKey: body.apiKey ?? settings?.apiKey,
          apiSecret: body.apiSecret ?? settings?.apiSecret,
        });
        setLastTestResult(result as CdonTestResult);
      } catch (err: any) {
        console.error('Test CDON connection failed:', err);
        setLastTestResult({ ok: false, error: 'Failed to test connection' });
      } finally {
        setIsTesting(false);
      }
    },
    [settings],
  );

  const exportProducts = useCallback(async (products: any[]): Promise<boolean> => {
    if (!Array.isArray(products) || products.length === 0) {
      setValidationErrors([
        { field: 'products', message: 'Select at least one product to export' },
      ]);
      return false;
    }
    setExporting(true);
    setLastExportResult(null);
    try {
      const res = await cdonApi.exportProducts(products);
      setLastExportResult(res as CdonExportResult);
      return true;
    } catch (err) {
      console.error('Export to CDON failed:', err);
      setLastExportResult(null);
      setValidationErrors([
        { field: 'general', message: 'Export failed. See console for details.' },
      ]);
      return false;
    } finally {
      setExporting(false);
    }
  }, []);

  const deleteCdonProduct = useCallback(async (_id: string) => {
    setValidationErrors([{ field: 'general', message: 'Delete not supported for CDON settings' }]);
  }, []);

  // ---- aliases expected by generic panel handlers ----
  const closeCdonProductPanel = useCallback(
    () => closeCdonSettingsPanel(),
    [closeCdonSettingsPanel],
  );
  const openCdonProductForEdit = useCallback(
    (item: any) => {
      // Settings object is used as the panel "item" for this plugin
      openCdonSettingsForEdit(item as CdonSettings);
    },
    [openCdonSettingsForEdit],
  );
  const openCdonProductForView = useCallback(
    (item: any) => openCdonSettingsForView(item as CdonSettings),
    [openCdonSettingsForView],
  );
  const saveCdonProduct = useCallback((data: any) => saveCdonSettings(data), [saveCdonSettings]);

  const value: CdonContextType = useMemo(
    () => ({
      isCdonProductsPanelOpen,
      currentCdonSettings,
      panelMode,
      validationErrors,
      isSaving,
      isTesting,
      exporting,
      lastTestResult,
      lastExportResult,
      settings,
      openCdonSettingsPanel,
      openCdonSettingsForEdit,
      openCdonSettingsForView,
      closeCdonSettingsPanel,
      loadCdonSettings,
      saveCdonSettings,
      testCdonConnection,
      exportProducts,
      clearValidationErrors,
      deleteCdonProduct,
      closeCdonProductPanel,
      openCdonProductForEdit,
      openCdonProductForView,
      saveCdonProduct,
    }),
    [
      isCdonProductsPanelOpen,
      currentCdonSettings,
      panelMode,
      validationErrors,
      isSaving,
      isTesting,
      exporting,
      lastTestResult,
      lastExportResult,
      settings,
      openCdonSettingsPanel,
      openCdonSettingsForEdit,
      openCdonSettingsForView,
      closeCdonSettingsPanel,
      loadCdonSettings,
      saveCdonSettings,
      testCdonConnection,
      exportProducts,
      clearValidationErrors,
      deleteCdonProduct,
      closeCdonProductPanel,
      openCdonProductForEdit,
      openCdonProductForView,
      saveCdonProduct,
    ],
  );

  return <CdonContext.Provider value={value}>{children}</CdonContext.Provider>;
}

export function useCdonProducts() {
  const ctx = useContext(CdonContext);
  if (!ctx) {
    throw new Error('useCdonProducts must be used within CdonProductsProvider');
  }
  return ctx;
}
