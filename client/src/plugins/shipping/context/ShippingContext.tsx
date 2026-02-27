import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useApp } from '@/core/api/AppContext';

import { shippingApi } from '../api/shippingApi';
import { ShippingBookModal } from '../components/ShippingBookModal';
import type {
  BookPostnordResponse,
  LabelFormatMode,
  ShippingSender,
  ShippingServicePreset,
  ShippingSettings,
  ValidationError,
} from '../types/shipping';

const RECENT_SERVICES_KEY = 'homebase:shipping:recentServices';
const DEFAULT_WEIGHT_KG = 0.15;

interface ShippingContextType {
  isShippingPanelOpen: boolean;
  currentShippingSettings: ShippingSettings | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];
  isSaving: boolean;
  isBooking: boolean;

  settings: ShippingSettings | null;
  senders: ShippingSender[];
  services: ShippingServicePreset[];

  isShippingBookModalOpen: boolean;
  selectedOrderIds: string[];
  weightsKgByOrder: Record<string, number>;
  recentServiceIds: string[];

  loadShippingData: () => Promise<void>;
  openShippingPanel: (settings: ShippingSettings | null) => void;
  openShippingForEdit: (settings: ShippingSettings) => void;
  openShippingForView: (settings: ShippingSettings) => void;
  closeShippingPanel: () => void;
  saveShipping: (data: Partial<ShippingSettings>) => Promise<boolean>;
  deleteShipping: (_id: string) => Promise<void>;
  clearValidationErrors: () => void;

  createSender: (data: Partial<ShippingSender>) => Promise<void>;
  updateSender: (id: string, data: Partial<ShippingSender>) => Promise<void>;
  deleteSender: (id: string) => Promise<void>;
  createService: (data: Partial<ShippingServicePreset>) => Promise<void>;
  updateService: (id: string, data: Partial<ShippingServicePreset>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;

  openBookModal: (orderIds: string[]) => void;
  closeBookModal: () => void;
  setWeightForOrder: (orderId: string, weightKg: number) => void;
  bookPostnord: (payload: {
    senderId: string;
    serviceId: string;
    labelFormat?: LabelFormatMode;
  }) => Promise<BookPostnordResponse>;
}

const ShippingContext = createContext<ShippingContextType | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function ShippingProvider({ children, isAuthenticated, onCloseOtherPanels }: ProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  const [isShippingPanelOpen, setIsShippingPanelOpen] = useState(false);
  const [currentShippingSettings, setCurrentShippingSettings] = useState<ShippingSettings | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  const [settings, setSettings] = useState<ShippingSettings | null>(null);
  const [senders, setSenders] = useState<ShippingSender[]>([]);
  const [services, setServices] = useState<ShippingServicePreset[]>([]);

  const [isShippingBookModalOpen, setIsShippingBookModalOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [weightsKgByOrder, setWeightsKgByOrder] = useState<Record<string, number>>({});
  const [recentServiceIds, setRecentServiceIds] = useState<string[]>([]);

  const clearValidationErrors = useCallback(() => setValidationErrors([]), []);

  const loadShippingData = useCallback(async () => {
    const [settingsData, senderData, serviceData] = await Promise.all([
      shippingApi.getSettings(),
      shippingApi.listSenders(),
      shippingApi.listServices(),
    ]);
    setSettings(settingsData);
    setCurrentShippingSettings(settingsData);
    setSenders(Array.isArray(senderData) ? senderData : []);
    setServices(Array.isArray(serviceData) ? serviceData : []);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadShippingData().catch((error) => {
        console.error('Failed to load shipping data:', error);
      });
      try {
        const parsed = JSON.parse(localStorage.getItem(RECENT_SERVICES_KEY) || '[]');
        setRecentServiceIds(Array.isArray(parsed) ? parsed.map((v) => String(v)) : []);
      } catch {
        setRecentServiceIds([]);
      }
    } else {
      setSettings(null);
      setCurrentShippingSettings(null);
      setSenders([]);
      setServices([]);
      setSelectedOrderIds([]);
      setWeightsKgByOrder({});
      setRecentServiceIds([]);
    }
  }, [isAuthenticated, loadShippingData]);

  const closeBookModal = useCallback(() => {
    setIsShippingBookModalOpen(false);
    setSelectedOrderIds([]);
    setWeightsKgByOrder({});
  }, []);

  const closeShippingPanel = useCallback(() => {
    setIsShippingPanelOpen(false);
    setCurrentShippingSettings(settings);
    setPanelMode('create');
    setValidationErrors([]);
  }, [settings]);

  const closeShippingPanelRef = useRef(closeShippingPanel);
  closeShippingPanelRef.current = closeShippingPanel;

  useEffect(() => {
    registerPanelCloseFunction('shipping', () => closeShippingPanelRef.current());
    return () => unregisterPanelCloseFunction('shipping');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction]);

  const openShippingPanel = useCallback(
    (s: ShippingSettings | null) => {
      setCurrentShippingSettings(s);
      setPanelMode(s ? 'edit' : 'create');
      setIsShippingPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openShippingForEdit = useCallback(
    (s: ShippingSettings) => {
      setCurrentShippingSettings(s);
      setPanelMode('edit');
      setIsShippingPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openShippingForView = useCallback(
    (s: ShippingSettings) => {
      setCurrentShippingSettings(s);
      setPanelMode('view');
      setIsShippingPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  useEffect(() => {
    (window as any).submitShippingForm = () => {
      window.dispatchEvent(new CustomEvent('submitShippingForm'));
    };
    (window as any).cancelShippingForm = () => {
      window.dispatchEvent(new CustomEvent('cancelShippingForm'));
    };
    return () => {
      delete (window as any).submitShippingForm;
      delete (window as any).cancelShippingForm;
    };
  }, []);

  const saveShipping = useCallback(async (data: Partial<ShippingSettings>): Promise<boolean> => {
    setIsSaving(true);
    try {
      const saved = await shippingApi.upsertSettings(data);
      setSettings(saved);
      setCurrentShippingSettings(saved);
      setPanelMode('view');
      setValidationErrors([]);
      return true;
    } catch (err: any) {
      const message = err?.message || 'Failed to save shipping settings';
      setValidationErrors([{ field: 'general', message }]);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const deleteShipping = useCallback(async (_id: string) => {
    setValidationErrors([{ field: 'general', message: 'Delete is not supported for settings.' }]);
  }, []);

  const createSender = useCallback(async (data: Partial<ShippingSender>) => {
    const created = await shippingApi.createSender(data);
    setSenders((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  const updateSender = useCallback(async (id: string, data: Partial<ShippingSender>) => {
    const updated = await shippingApi.updateSender(id, data);
    setSenders((prev) =>
      prev
        .map((s) => (s.id === id ? updated : s))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }, []);

  const deleteSender = useCallback(async (id: string) => {
    await shippingApi.deleteSender(id);
    setSenders((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const createService = useCallback(async (data: Partial<ShippingServicePreset>) => {
    const created = await shippingApi.createService(data);
    setServices((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  const updateService = useCallback(async (id: string, data: Partial<ShippingServicePreset>) => {
    const updated = await shippingApi.updateService(id, data);
    setServices((prev) =>
      prev
        .map((s) => (s.id === id ? updated : s))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }, []);

  const deleteService = useCallback(async (id: string) => {
    await shippingApi.deleteService(id);
    setServices((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const openBookModal = useCallback(
    (orderIds: string[]) => {
      const ids = Array.isArray(orderIds) ? orderIds.map(String) : [];
      setSelectedOrderIds(ids);
      const nextWeights: Record<string, number> = {};
      ids.forEach((id) => {
        nextWeights[id] = DEFAULT_WEIGHT_KG;
      });
      setWeightsKgByOrder(nextWeights);
      setIsShippingBookModalOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const setWeightForOrder = useCallback((orderId: string, weightKg: number) => {
    setWeightsKgByOrder((prev) => ({ ...prev, [orderId]: weightKg }));
  }, []);

  const bookPostnord = useCallback(
    async (payload: { senderId: string; serviceId: string; labelFormat?: LabelFormatMode }) => {
      setIsBooking(true);
      try {
        const res = await shippingApi.bookPostnord({
          orderIds: selectedOrderIds,
          senderId: payload.senderId,
          serviceId: payload.serviceId,
          labelFormat: payload.labelFormat,
          weightsKgByOrder,
        });

        setRecentServiceIds((prev) => {
          const next = [payload.serviceId, ...prev.filter((id) => id !== payload.serviceId)].slice(0, 5);
          localStorage.setItem(RECENT_SERVICES_KEY, JSON.stringify(next));
          return next;
        });

        window.dispatchEvent(
          new CustomEvent('shipping:booked', {
            detail: { updatedOrderIds: res.updatedOrderIds || [] },
          }),
        );
        return res;
      } finally {
        setIsBooking(false);
      }
    },
    [selectedOrderIds, weightsKgByOrder],
  );

  const value = useMemo<ShippingContextType>(
    () => ({
      isShippingPanelOpen,
      currentShippingSettings,
      panelMode,
      validationErrors,
      isSaving,
      isBooking,
      settings,
      senders,
      services,
      isShippingBookModalOpen,
      selectedOrderIds,
      weightsKgByOrder,
      recentServiceIds,
      loadShippingData,
      openShippingPanel,
      openShippingForEdit,
      openShippingForView,
      closeShippingPanel,
      saveShipping,
      deleteShipping,
      clearValidationErrors,
      createSender,
      updateSender,
      deleteSender,
      createService,
      updateService,
      deleteService,
      openBookModal,
      closeBookModal,
      setWeightForOrder,
      bookPostnord,
    }),
    [
      isShippingPanelOpen,
      currentShippingSettings,
      panelMode,
      validationErrors,
      isSaving,
      isBooking,
      settings,
      senders,
      services,
      isShippingBookModalOpen,
      selectedOrderIds,
      weightsKgByOrder,
      recentServiceIds,
      loadShippingData,
      openShippingPanel,
      openShippingForEdit,
      openShippingForView,
      closeShippingPanel,
      saveShipping,
      deleteShipping,
      clearValidationErrors,
      createSender,
      updateSender,
      deleteSender,
      createService,
      updateService,
      deleteService,
      openBookModal,
      closeBookModal,
      setWeightForOrder,
      bookPostnord,
    ],
  );

  return (
    <ShippingContext.Provider value={value}>
      {children}
      <ShippingBookModal />
    </ShippingContext.Provider>
  );
}

export function useShipping() {
  const ctx = useContext(ShippingContext);
  if (!ctx) throw new Error('useShipping must be used within ShippingProvider');
  return ctx;
}
