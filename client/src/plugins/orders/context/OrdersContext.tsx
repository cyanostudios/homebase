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

import { ordersApi, type OrdersListFilters } from '../api/ordersApi';
import type { OrderDetails, OrderListItem, OrderStatus, ValidationError } from '../types/orders';

interface OrdersContextType {
  // Panel state
  isOrdersPanelOpen: boolean;
  currentOrder: OrderDetails | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];

  // Data
  orders: OrderListItem[];
  totalOrders: number;
  filters: OrdersListFilters;

  // Actions
  setFilters: (filters: OrdersListFilters) => void;
  reloadOrders: () => Promise<void>;
  openOrderPanel: (order: OrderDetails | null) => void;
  openOrderForEdit: (order: OrderDetails) => void;
  openOrderForView: (order: OrderListItem | OrderDetails) => Promise<void>;
  closeOrderPanel: () => void;
  saveOrder: (data: {
    status: OrderStatus;
    carrier?: string;
    trackingNumber?: string;
  }) => Promise<boolean>;
  deleteOrder: (_id: string) => Promise<void>;
  clearValidationErrors: () => void;
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
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  const [isOrdersPanelOpen, setIsOrdersPanelOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OrderDetails | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('view');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [filters, setFiltersState] = useState<OrdersListFilters>({
    status: 'processing',
    limit: 50,
    offset: 0,
  });

  const clearValidationErrors = useCallback(() => setValidationErrors([]), []);

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
    if (isAuthenticated) {
      reloadOrders();
    } else {
      setOrders([]);
      setTotalOrders(0);
      setCurrentOrder(null);
      setIsOrdersPanelOpen(false);
      setValidationErrors([]);
    }
  }, [isAuthenticated, reloadOrders]);

  const closeOrderPanel = useCallback(() => {
    setIsOrdersPanelOpen(false);
    setCurrentOrder(null);
    setPanelMode('view');
    setValidationErrors([]);
  }, []);

  // Register panel-close with AppContext (empty deps is required by the system)
  useEffect(() => {
    registerPanelCloseFunction('orders', closeOrderPanel);
    return () => unregisterPanelCloseFunction('orders');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global form actions
  useEffect(() => {
    (window as any).submitOrdersForm = () => {
      window.dispatchEvent(new CustomEvent('submitOrderForm'));
    };
    (window as any).cancelOrdersForm = () => {
      window.dispatchEvent(new CustomEvent('cancelOrderForm'));
    };
    return () => {
      delete (window as any).submitOrdersForm;
      delete (window as any).cancelOrdersForm;
    };
  }, []);

  const setFilters = useCallback((next: OrdersListFilters) => {
    setFiltersState(next);
  }, []);

  const openOrderPanel = useCallback(
    (order: OrderDetails | null) => {
      setCurrentOrder(order);
      setPanelMode(order ? 'view' : 'view');
      setIsOrdersPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openOrderForEdit = useCallback(
    (order: OrderDetails) => {
      setCurrentOrder(order);
      setPanelMode('edit');
      setIsOrdersPanelOpen(true);
      setValidationErrors([]);
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
      setPanelMode('view');
      setIsOrdersPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const saveOrder = useCallback(
    async (data: {
      status: OrderStatus;
      carrier?: string;
      trackingNumber?: string;
    }): Promise<boolean> => {
      clearValidationErrors();

      if (!currentOrder?.id) {
        setValidationErrors([{ field: 'general', message: 'No order selected' }]);
        return false;
      }

      try {
        const updated = await ordersApi.updateStatus(currentOrder.id, data);
        const updatedNormalized = normalizeOrderListItem(updated) as any;

        setOrders((prev) => prev.map((o) => (o.id === currentOrder.id ? updatedNormalized : o)));
        setCurrentOrder((prev) =>
          prev
            ? ({ ...(prev as any), ...updatedNormalized } as OrderDetails)
            : (updatedNormalized as OrderDetails),
        );
        setPanelMode('view');
        return true;
      } catch (err: any) {
        console.error('Failed to update order:', err);
        if (err?.errors) {
          setValidationErrors(err.errors);
        } else {
          setValidationErrors([
            { field: 'general', message: err?.message || 'Failed to update order' },
          ]);
        }
        return false;
      }
    },
    [clearValidationErrors, currentOrder?.id],
  );

  const deleteOrder = useCallback(async (_id: string) => {
    setValidationErrors([{ field: 'general', message: 'Delete is not supported for orders' }]);
  }, []);

  const value: OrdersContextType = useMemo(
    () => ({
      isOrdersPanelOpen,
      currentOrder,
      panelMode,
      validationErrors,
      orders,
      totalOrders,
      filters,
      setFilters,
      reloadOrders,
      openOrderPanel,
      openOrderForEdit,
      openOrderForView,
      closeOrderPanel,
      saveOrder,
      deleteOrder,
      clearValidationErrors,
    }),
    [
      isOrdersPanelOpen,
      currentOrder,
      panelMode,
      validationErrors,
      orders,
      totalOrders,
      filters,
      setFilters,
      reloadOrders,
      openOrderPanel,
      openOrderForEdit,
      openOrderForView,
      closeOrderPanel,
      saveOrder,
      deleteOrder,
      clearValidationErrors,
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
