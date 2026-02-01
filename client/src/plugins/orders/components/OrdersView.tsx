import React from 'react';

import { useOrders } from '../hooks/useOrders';
import type { OrderDetails, OrderListItem } from '../types/orders';

function fmtDate(d: any) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString();
}

function fmtMoney(amount: any, currency?: string | null) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'SEK' }).format(n);
}

export const OrdersView: React.FC<{ order?: OrderDetails; item?: any }> = ({ order, item }) => {
  const { currentOrder, openOrderForEdit } = useOrders();
  const o: OrderDetails | OrderListItem | null = (order || item || currentOrder) as any;

  if (!o) return <div className="p-4 text-gray-500">No order selected</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-gray-500">{o.channel}</div>
          <div className="text-lg font-semibold text-gray-900">
            {o.platformOrderNumber || 'Order'}
            <span className="text-sm font-normal text-gray-500 ml-2">{o.channelOrderId}</span>
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {fmtDate(o.placedAt)} · {fmtMoney(o.totalAmount, o.currency)}
          </div>
        </div>

        {'items' in o ? (
          <button
            onClick={() => openOrderForEdit(o as OrderDetails)}
            className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          >
            Edit status
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-900 mb-2">Status</div>
          <div className="text-sm text-gray-800">Status: {o.status}</div>
          <div className="text-sm text-gray-800 mt-1">Carrier: {o.shippingCarrier || '—'}</div>
          <div className="text-sm text-gray-800 mt-1">Tracking: {o.shippingTrackingNumber || '—'}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-900 mb-2">Customer</div>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap">
            {JSON.stringify((o as any).customer || null, null, 2)}
          </pre>
        </div>
      </div>

      {'items' in o ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="text-sm font-semibold text-gray-900">Items</div>
          </div>
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(o as OrderDetails).items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{it.sku || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{it.title || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{it.quantity}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">
                    {fmtMoney(it.unitPrice, o.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-gray-500">Open an order to see details.</div>
      )}
    </div>
  );
};

