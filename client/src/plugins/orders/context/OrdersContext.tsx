import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { useApp } from '@/core/api/AppContext';
import {
  getAppCurrentPage,
  isOrdersBootstrapPage,
  subscribeAppCurrentPage,
} from '@/core/navigation/appCurrentPageStore';
import { DEFAULT_LIST_PAGE_SIZE, normalizeListPageSize } from '@/core/settings/listPageSizes';

import { ordersApi, type OrdersListFilters } from '../api/ordersApi';
import type { OrderDetails, OrderListItem, OrderSettings } from '../types/orders';

interface OrdersContextType {
  // Panel state (orders panel is view-only)
  isOrdersPanelOpen: boolean;
  currentOrder: OrderDetails | null;
  panelMode: 'view';
  validationErrors: { field: string; message: string }[];

  // Data
  orders: OrderListItem[];
  totalOrders: number;
  /** True while list fetch (filters change, reload, initial bootstrap) is in flight. */
  ordersListLoading: boolean;
  filters: OrdersListFilters;

  // Actions
  setFilters: (
    filters: OrdersListFilters | ((prev: OrdersListFilters) => OrdersListFilters),
  ) => void;
  reloadOrders: () => Promise<void>;
  /** Optimistic update: replace order(s) in list without refetch. For fire-and-forget. */
  updateOrderInList: (updated: OrderListItem | OrderDetails) => void;
  updateOrdersInList: (ids: string[], updates: Partial<OrderListItem>) => void;
  openOrderPanel: (order: OrderDetails | null) => void;
  openOrderForView: (order: OrderListItem | OrderDetails) => Promise<void>;
  closeOrderPanel: () => void;
  deleteOrder: (_id: string) => Promise<void>;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

function normalizeOrderListItem(item: any): OrderListItem {
  return {
    ...item,
    placedAt: item?.placedAt ? new Date(item.placedAt) : null,
    createdAt: item?.createdAt ? new Date(item.createdAt) : null,
    updatedAt: item?.updatedAt ? new Date(item.updatedAt) : null,
  };
}

function normalizeOrderDetails(item: any): OrderDetails {
  const base = normalizeOrderListItem(item) as any;
  return {
    ...base,
    items: Array.isArray(item?.items)
      ? item.items.map((it: any) => ({
          ...it,
          createdAt: it?.createdAt ? new Date(it.createdAt) : null,
        }))
      : [],
  };
}

export function OrdersProvider({ children, isAuthenticated, onCloseOtherPanels }: ProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction, getSettings, settingsVersion } =
    useApp();
  const activePage = useSyncExternalStore(
    subscribeAppCurrentPage,
    getAppCurrentPage,
    getAppCurrentPage,
  );
  const shouldBootstrapOrders = isAuthenticated && isOrdersBootstrapPage(activePage);

  const [isOrdersPanelOpen, setIsOrdersPanelOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OrderDetails | null>(null);

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [ordersListLoading, setOrdersListLoading] = useState(false);
  const ordersLoadGenerationRef = useRef(0);
  const [filters, setFiltersState] = useState<OrdersListFilters>({
    status: 'processing',
    limit: DEFAULT_LIST_PAGE_SIZE,
    offset: 0,
    sort: 'placed',
    order: 'desc',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let cancelled = false;
    void getSettings('orders').then((raw) => {
      if (cancelled) {
        return;
      }
      const s = (raw && typeof raw === 'object' ? raw : {}) as OrderSettings;
      const lim = normalizeListPageSize(s.listPageSize);
      setFiltersState((prev) => {
        if (prev.limit === lim) {
          return prev;
        }
        return { ...prev, limit: lim, offset: 0 };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, getSettings, settingsVersion]);

  const reloadOrders = useCallback(async () => {
    try {
      const res = await ordersApi.list(filters);
      const items = Array.isArray(res?.items) ? res.items : [];
      const total = typeof res?.total === 'number' ? res.total : 0;
      setOrders(items.map(normalizeOrderListItem));
      setTotalOrders(total);
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
  }, [filters]);

  useEffect(() => {
    if (!isAuthenticated) {
      ordersLoadGenerationRef.current += 1;
      setOrdersListLoading(false);
      setOrders([]);
      setTotalOrders(0);
      setCurrentOrder(null);
      setIsOrdersPanelOpen(false);
      setFiltersState({
        status: 'processing',
        limit: DEFAULT_LIST_PAGE_SIZE,
        offset: 0,
        sort: 'placed',
        order: 'desc',
      });
      return;
    }
    if (!shouldBootstrapOrders) {
      return;
    }
    void reloadOrders();
  }, [isAuthenticated, shouldBootstrapOrders, reloadOrders]);

  const closeOrderPanel = useCallback(() => {
    setIsOrdersPanelOpen(false);
    setCurrentOrder(null);
  }, []);

  // Register panel-close with AppContext (empty deps is required by the system)
  useEffect(() => {
    registerPanelCloseFunction('orders', closeOrderPanel);
    return () => unregisterPanelCloseFunction('orders');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFilters = useCallback(
    (next: OrdersListFilters | ((prev: OrdersListFilters) => OrdersListFilters)) => {
      setFiltersState((prev) => (typeof next === 'function' ? next(prev) : next));
    },
    [],
  );

  const updateOrderInList = useCallback(
    (updated: OrderListItem | OrderDetails) => {
      const normalized = normalizeOrderListItem(updated);
      const statusFilter = filters.status;
      setOrders((prev) => {
        if (statusFilter && normalized.status !== statusFilter) {
          const removed = prev.some((o) => String(o.id) === String(updated.id));
          if (removed) {
            setTotalOrders((t) => Math.max(0, t - 1));
          }
          return prev.filter((o) => String(o.id) !== String(updated.id));
        }
        return prev.map((o) => (String(o.id) === String(updated.id) ? normalized : o));
      });
    },
    [filters.status],
  );

  const updateOrdersInList = useCallback(
    (ids: string[], updates: Partial<OrderListItem>) => {
      const idSet = new Set(ids.map(String));
      const statusFilter = filters.status;
      setOrders((prev) => {
        const next = prev.flatMap((o) => {
          if (!idSet.has(String(o.id))) {
            return [o];
          }
          const merged = { ...o, ...updates };
          const newStatus = (merged.status ?? o.status) as string | undefined;
          if (statusFilter && newStatus !== statusFilter) {
            return [];
          }
          return [normalizeOrderListItem(merged)];
        });
        const removedCount = prev.length - next.length;
        if (removedCount > 0) {
          setTotalOrders((t) => Math.max(0, t - removedCount));
        }
        return next;
      });
    },
    [filters.status],
  );

  const openOrderPanel = useCallback(
    (order: OrderDetails | null) => {
      setCurrentOrder(order);
      setIsOrdersPanelOpen(true);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openOrderForView = useCallback(
    async (order: OrderListItem | OrderDetails) => {
      try {
        const full = await ordersApi.get(String(order.id));
        setCurrentOrder(normalizeOrderDetails(full));
      } catch (err) {
        console.error('Failed to load order:', err);
        // fallback: show whatever we have
        setCurrentOrder(order as any);
      }
      setIsOrdersPanelOpen(true);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const deleteOrder = useCallback(async (_id: string) => {
    // Delete is not supported for orders
  }, []);

  const value: OrdersContextType = useMemo(
    () => ({
      isOrdersPanelOpen,
      currentOrder,
      panelMode: 'view' as const,
      validationErrors: [],
      orders,
      totalOrders,
      ordersListLoading,
      filters,
      setFilters,
      reloadOrders,
      updateOrderInList,
      updateOrdersInList,
      openOrderPanel,
      openOrderForView,
      closeOrderPanel,
      deleteOrder,
    }),
    [
      isOrdersPanelOpen,
      currentOrder,
      orders,
      totalOrders,
      ordersListLoading,
      filters,
      setFilters,
      reloadOrders,
      updateOrderInList,
      updateOrdersInList,
      openOrderPanel,
      openOrderForView,
      closeOrderPanel,
      deleteOrder,
    ],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) {
    throw new Error('useOrders must be used within OrdersProvider');
  }
  return ctx;
}
