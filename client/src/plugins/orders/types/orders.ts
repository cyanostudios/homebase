import type { ListPageSize } from '@/core/settings/listPageSizes';

export type OrderStatus = 'processing' | 'shipped' | 'delivered' | 'cancelled';

/** Server `GET /api/orders` sort column (whitelist). */
export type OrdersListSortField =
  | 'placed'
  | 'channel'
  | 'order_number'
  | 'customer'
  | 'total'
  | 'status';

export type OrdersListSortOrder = 'asc' | 'desc';

/** Orders plugin settings (user_settings category: orders). */
export interface OrderSettings {
  /** Rows per page in the order list (default 100). */
  listPageSize?: ListPageSize;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface OrderListItem {
  id: string;
  channel: string;
  channelOrderId: string;
  /** Resolved store/channel display name (e.g. "Mobilhallen"). Set by server for WooCommerce; client uses for CDON/Fyndiq from raw. */
  channelLabel?: string | null;
  platformOrderNumber?: string | null;
  orderNumber?: number | null;
  placedAt?: Date | string | null;
  totalAmount?: number | null;
  currency?: string | null;
  status: OrderStatus | string;
  shippingCarrier?: string | null;
  shippingTrackingNumber?: string | null;
  shippingAddress?: any;
  customer?: any;
  raw?: any;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  sku?: string | null;
  productId?: string | null;
  title?: string | null;
  quantity: number;
  unitPrice?: number | null;
  vatRate?: number | null;
  raw?: any;
  createdAt?: Date | string | null;
}

export interface OrderDetails extends OrderListItem {
  shippingAddress?: any;
  billingAddress?: any;
  customer?: any;
  items: OrderItem[];
}
