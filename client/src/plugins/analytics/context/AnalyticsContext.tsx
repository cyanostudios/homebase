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

import { analyticsApi } from '../api/analyticsApi';
import type {
  AnalyticsChannelItem,
  AnalyticsFilters,
  AnalyticsOverview,
  AnalyticsTimeSeriesItem,
  AnalyticsTopProductItem,
  AnalyticsDrilldownOrderItem,
} from '../types/analytics';

interface AnalyticsContextType {
  isAnalyticsPanelOpen: boolean;
  currentAnalytic: null;
  panelMode: 'view';
  validationErrors: { field: string; message: string }[];
  closeAnalyticPanel: () => void;

  filters: AnalyticsFilters;
  setFilters: (next: AnalyticsFilters) => void;
  reloadAnalytics: () => Promise<void>;
  loading: boolean;
  error: string | null;

  overview: AnalyticsOverview;
  timeSeries: AnalyticsTimeSeriesItem[];
  channels: AnalyticsChannelItem[];
  topProducts: AnalyticsTopProductItem[];
  selectedSku: string | null;
  setSelectedSku: (sku: string | null) => void;
  drilldownOrders: AnalyticsDrilldownOrderItem[];
  exportTopProductsCsv: () => Promise<void>;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

const EMPTY_OVERVIEW: AnalyticsOverview = {
  revenue: 0,
  orderCount: 0,
  aov: 0,
  unitsSold: 0,
};

export function AnalyticsProvider({ children, isAuthenticated }: ProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  const [filters, setFiltersState] = useState<AnalyticsFilters>({
    granularity: 'day',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview>(EMPTY_OVERVIEW);
  const [timeSeries, setTimeSeries] = useState<AnalyticsTimeSeriesItem[]>([]);
  const [channels, setChannels] = useState<AnalyticsChannelItem[]>([]);
  const [topProducts, setTopProducts] = useState<AnalyticsTopProductItem[]>([]);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [drilldownOrders, setDrilldownOrders] = useState<AnalyticsDrilldownOrderItem[]>([]);

  const reloadAnalytics = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [overviewData, timeData, channelData, topData] = await Promise.all([
        analyticsApi.getOverview(filters),
        analyticsApi.getTimeSeries(filters),
        analyticsApi.getChannels(filters),
        analyticsApi.getTopProducts(filters, 20),
      ]);
      setOverview(overviewData);
      setTimeSeries(timeData);
      setChannels(channelData);
      setTopProducts(topData);
      if (selectedSku) {
        const details = await analyticsApi.getDrilldownOrders(filters, {
          sku: selectedSku,
          limit: 50,
        });
        setDrilldownOrders(details);
      } else {
        setDrilldownOrders([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [filters, isAuthenticated, selectedSku]);

  useEffect(() => {
    if (isAuthenticated) {
      void reloadAnalytics();
    } else {
      setOverview(EMPTY_OVERVIEW);
      setTimeSeries([]);
      setChannels([]);
      setTopProducts([]);
      setSelectedSku(null);
      setDrilldownOrders([]);
      setError(null);
    }
  }, [isAuthenticated, reloadAnalytics]);

  const exportTopProductsCsv = useCallback(async () => {
    const blob = await analyticsApi.downloadTopProductsCsv(filters, 200);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analytics-top-products.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [filters]);

  const closeAnalyticPanel = useCallback(() => {}, []);

  useEffect(() => {
    registerPanelCloseFunction('analytics', closeAnalyticPanel);
    return () => unregisterPanelCloseFunction('analytics');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AnalyticsContextType = useMemo(
    () => ({
      isAnalyticsPanelOpen: false,
      currentAnalytic: null,
      panelMode: 'view',
      validationErrors: [],
      closeAnalyticPanel,
      filters,
      setFilters: setFiltersState,
      reloadAnalytics,
      loading,
      error,
      overview,
      timeSeries,
      channels,
      topProducts,
      selectedSku,
      setSelectedSku,
      drilldownOrders,
      exportTopProductsCsv,
    }),
    [
      closeAnalyticPanel,
      filters,
      reloadAnalytics,
      loading,
      error,
      overview,
      timeSeries,
      channels,
      topProducts,
      selectedSku,
      drilldownOrders,
      exportTopProductsCsv,
    ],
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalyticsContext() {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) {
    throw new Error('useAnalyticsContext must be used within AnalyticsProvider');
  }
  return ctx;
}
