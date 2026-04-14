import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { useApp } from '@/core/api/AppContext';
import {
  getAppCurrentPage,
  isAnalyticsBootstrapPage,
  subscribeAppCurrentPage,
} from '@/core/navigation/appCurrentPageStore';

import { analyticsApi } from '../api/analyticsApi';
import type {
  AnalyticsChannelItem,
  AnalyticsCustomerSegments,
  AnalyticsDrilldownOrderItem,
  AnalyticsFilters,
  AnalyticsOverview,
  AnalyticsStatusDistributionItem,
  AnalyticsTimeSeriesItem,
  AnalyticsTopProductItem,
} from '../types/analytics';
import { getPresetRangeUtcIso } from '../utils/datePresets';

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
  statusDistribution: AnalyticsStatusDistributionItem[];
  customerSegments: AnalyticsCustomerSegments;
  channels: AnalyticsChannelItem[];
  /** All channels (no channel filter) – for dropdown options so user can switch between channels */
  allChannelsForDropdown: AnalyticsChannelItem[];
  topProducts: AnalyticsTopProductItem[];
  selectedSku: string | null;
  setSelectedSku: (sku: string | null) => void;
  drilldownOrders: AnalyticsDrilldownOrderItem[];
  selectedChannelDrilldown: {
    channel: string;
    channelInstanceId: number | null;
    channelLabel: string | null;
  } | null;
  setSelectedChannelDrilldown: (
    next: { channel: string; channelInstanceId: number | null; channelLabel: string | null } | null,
  ) => void;
  channelDrilldownOrders: AnalyticsDrilldownOrderItem[];
  exportTopProductsCsv: () => Promise<void>;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

const EMPTY_OVERVIEW: AnalyticsOverview = {
  byCurrency: [],
  unitsSold: 0,
};

const EMPTY_CUSTOMER_SEGMENTS: AnalyticsCustomerSegments = {
  newCustomers: 0,
  returningCustomers: 0,
  newCustomerOrders: 0,
  returningCustomerOrders: 0,
  unidentifiedOrders: 0,
};

export function AnalyticsProvider({ children, isAuthenticated }: ProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const activePage = useSyncExternalStore(
    subscribeAppCurrentPage,
    getAppCurrentPage,
    getAppCurrentPage,
  );
  const shouldFetchAnalytics = isAuthenticated && isAnalyticsBootstrapPage(activePage);

  const [filters, setFiltersState] = useState<AnalyticsFilters>(() => {
    const { from, to } = getPresetRangeUtcIso('last30');
    return { from, to, granularity: 'day' };
  });
  const [debouncedFilters, setDebouncedFilters] = useState<AnalyticsFilters>(() => {
    const { from, to } = getPresetRangeUtcIso('last30');
    return { from, to, granularity: 'day' };
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview>(EMPTY_OVERVIEW);
  const [timeSeries, setTimeSeries] = useState<AnalyticsTimeSeriesItem[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<AnalyticsStatusDistributionItem[]>(
    [],
  );
  const [customerSegments, setCustomerSegments] =
    useState<AnalyticsCustomerSegments>(EMPTY_CUSTOMER_SEGMENTS);
  const [channels, setChannels] = useState<AnalyticsChannelItem[]>([]);
  const [allChannelsForDropdown, setAllChannelsForDropdown] = useState<AnalyticsChannelItem[]>([]);
  const [topProducts, setTopProducts] = useState<AnalyticsTopProductItem[]>([]);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [selectedChannelDrilldown, setSelectedChannelDrilldown] = useState<{
    channel: string;
    channelInstanceId: number | null;
    channelLabel: string | null;
  } | null>(null);
  const [drilldownOrders, setDrilldownOrders] = useState<AnalyticsDrilldownOrderItem[]>([]);
  const [channelDrilldownOrders, setChannelDrilldownOrders] = useState<
    AnalyticsDrilldownOrderItem[]
  >([]);

  const fetchSummaryData = useCallback(
    async (activeFilters: AnalyticsFilters, setSpinner = true) => {
      if (!isAuthenticated) {
        return;
      }
      if (setSpinner) {
        setLoading(true);
      }
      setError(null);
      try {
        const [summary, topData] = await Promise.all([
          analyticsApi.getSummary(activeFilters),
          analyticsApi.getTopProducts(activeFilters, 20),
        ]);
        setOverview(summary.overview || EMPTY_OVERVIEW);
        setTimeSeries(Array.isArray(summary.timeSeries) ? summary.timeSeries : []);
        setStatusDistribution(
          Array.isArray(summary.statusDistribution) ? summary.statusDistribution : [],
        );
        setCustomerSegments(summary.customerSegments || EMPTY_CUSTOMER_SEGMENTS);
        setChannels(Array.isArray(summary.channels) ? summary.channels : []);
        setAllChannelsForDropdown(
          Array.isArray(summary.allChannelsForDropdown) ? summary.allChannelsForDropdown : [],
        );
        setTopProducts(topData);
      } catch (err: any) {
        setError(err?.message || 'Failed to load analytics');
      } finally {
        if (setSpinner) {
          setLoading(false);
        }
      }
    },
    [isAuthenticated],
  );

  const reloadAnalytics = useCallback(async () => {
    await fetchSummaryData(filters, true);
  }, [fetchSummaryData, filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFilters(filters);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    if (!isAuthenticated) {
      setOverview(EMPTY_OVERVIEW);
      setTimeSeries([]);
      setStatusDistribution([]);
      setCustomerSegments(EMPTY_CUSTOMER_SEGMENTS);
      setChannels([]);
      setAllChannelsForDropdown([]);
      setTopProducts([]);
      setSelectedSku(null);
      setSelectedChannelDrilldown(null);
      setDrilldownOrders([]);
      setChannelDrilldownOrders([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (!shouldFetchAnalytics) {
      setOverview(EMPTY_OVERVIEW);
      setTimeSeries([]);
      setStatusDistribution([]);
      setCustomerSegments(EMPTY_CUSTOMER_SEGMENTS);
      setChannels([]);
      setAllChannelsForDropdown([]);
      setTopProducts([]);
      setSelectedSku(null);
      setSelectedChannelDrilldown(null);
      setDrilldownOrders([]);
      setChannelDrilldownOrders([]);
      setError(null);
      setLoading(false);
      return;
    }
    void fetchSummaryData(debouncedFilters, true);
  }, [debouncedFilters, fetchSummaryData, isAuthenticated, shouldFetchAnalytics]);

  useEffect(() => {
    let cancelled = false;
    async function loadSkuDrilldown() {
      if (!isAuthenticated || !selectedSku) {
        setDrilldownOrders([]);
        return;
      }
      try {
        const { status: _s, ...filtersWithoutStatus } = filters;
        const details = await analyticsApi.getDrilldownOrders(filtersWithoutStatus, {
          sku: selectedSku,
          limit: 50,
        });
        if (!cancelled) {
          setDrilldownOrders(details);
        }
      } catch {
        if (!cancelled) {
          setDrilldownOrders([]);
        }
      }
    }
    void loadSkuDrilldown();
    return () => {
      cancelled = true;
    };
  }, [filters, isAuthenticated, selectedSku]);

  useEffect(() => {
    let cancelled = false;
    async function loadChannelDrilldown() {
      if (
        !isAuthenticated ||
        !selectedChannelDrilldown ||
        !isAnalyticsBootstrapPage(getAppCurrentPage())
      ) {
        setChannelDrilldownOrders([]);
        return;
      }
      try {
        const { status: _s, ...filtersWithoutStatus } = filters;
        const channelFilters: AnalyticsFilters = {
          ...filtersWithoutStatus,
          channel: selectedChannelDrilldown.channel,
          channelInstanceId: selectedChannelDrilldown.channelInstanceId ?? undefined,
        };
        const details = await analyticsApi.getDrilldownOrders(channelFilters, {
          limit: 50,
        });
        if (!cancelled) {
          setChannelDrilldownOrders(details);
        }
      } catch {
        if (!cancelled) {
          setChannelDrilldownOrders([]);
        }
      }
    }
    void loadChannelDrilldown();
    return () => {
      cancelled = true;
    };
  }, [filters, isAuthenticated, selectedChannelDrilldown]);

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
      statusDistribution,
      customerSegments,
      channels,
      allChannelsForDropdown,
      topProducts,
      selectedSku,
      setSelectedSku,
      drilldownOrders,
      selectedChannelDrilldown,
      setSelectedChannelDrilldown,
      channelDrilldownOrders,
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
      statusDistribution,
      customerSegments,
      channels,
      allChannelsForDropdown,
      topProducts,
      selectedSku,
      selectedChannelDrilldown,
      drilldownOrders,
      channelDrilldownOrders,
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
