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
  /** True when order has non-empty internal staff note (list endpoint; text is lazy-loaded). */
  hasStaffNote?: boolean;
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
  /** Antal orderrader med kopplat product_id (exkl. fraktrader utan product_id). */
  lineCount?: number | null;
  /** Summa quantity × produktvikt (kg) för rader med product_id och vikt. */
  orderWeight?: number | null;
  /** Unika Homebase product_id per order, kommaseparerade. */
  articleNumberList?: string | null;
  skuList?: string | null;
  eanList?: string | null;
  gtinList?: string | null;
  lagerplatsList?: string | null;
}

export type OrderLineKind = 'product' | 'shipping' | 'fee' | 'other';

export interface OrderItem {
  id: string;
  orderId: string;
  sku?: string | null;
  productId?: string | null;
  title?: string | null;
  quantity: number;
  unitPrice?: number | null;
  vatRate?: number | null;
  /** product = varurad; shipping = t.ex. WooCommerce shipping_lines; fee/other reserverat */
  lineKind?: OrderLineKind;
  raw?: any;
  createdAt?: Date | string | null;
}

export interface OrderDetails extends OrderListItem {
  shippingAddress?: any;
  billingAddress?: any;
  customer?: any;
  /** Full staff note when order was loaded with detail (`GET /api/orders/:id`). */
  staffNote?: string | null;
  items: OrderItem[];
}
