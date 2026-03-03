import React from 'react';

import { useOrders } from '../hooks/useOrders';
import type { OrderDetails, OrderListItem } from '../types/orders';
import { statusDisplayLabel } from '../utils/statusDisplay';

function fmtDate(d: any) {
  if (!d) {
    return '';
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) {
    return '';
  }
  return dt.toLocaleString();
}

function fmtMoney(amount: any, currency?: string | null) {
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    return '';
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'SEK',
  }).format(n);
}

function formatAddress(addr: Record<string, unknown> | null | undefined): string[] {
  if (!addr || typeof addr !== 'object') {
    return [];
  }
  const parts: string[] = [];
  const name =
    (addr.full_name as string) ||
    (addr.fullName as string) ||
    [addr.first_name, addr.last_name].filter(Boolean).join(' ').trim();
  if (name) {
    parts.push(name);
  }
  const street =
    (addr.street_address as string) || (addr.streetAddress as string) || (addr.address_1 as string);
  if (street) {
    parts.push(street);
  }
  const postal =
    (addr.postal_code as string) || (addr.postcode as string) || (addr.postalCode as string);
  const city = (addr.city as string) || (addr.state as string);
  const location = [postal, city].filter(Boolean).join(' ');
  if (location) {
    parts.push(location);
  }
  if (addr.country) {
    parts.push(String(addr.country));
  }
  return parts;
}

function formatCustomer(c: Record<string, unknown> | null | undefined) {
  if (!c || typeof c !== 'object') {
    return null;
  }
  const firstName = (c.firstName as string) || (c.first_name as string);
  const lastName = (c.lastName as string) || (c.last_name as string);
  const name = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
  const email = (c.email as string) || null;
  const phone =
    (c.phone as string) || (c.phone_mobile as string) || (c.phoneMobile as string) || null;
  const shipping = c.shippingAddress as Record<string, unknown> | undefined;
  const billing = c.billingAddress as Record<string, unknown> | undefined;
  return { name, email, phone, shipping, billing };
}

export const OrdersView: React.FC<{ order?: OrderDetails; item?: any }> = ({ order, item }) => {
  const { currentOrder, openOrderForEdit } = useOrders();
  const o: OrderDetails | OrderListItem | null = (order || item || currentOrder) as any;

  if (!o) {
    return <div className="p-4 text-gray-500">No order selected</div>;
  }

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
          <div className="text-sm text-gray-800">Status: {statusDisplayLabel(o.status)}</div>
          <div className="text-sm text-gray-800 mt-1">Carrier: {o.shippingCarrier || '—'}</div>
          <div className="text-sm text-gray-800 mt-1">
            Tracking: {o.shippingTrackingNumber || '—'}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-900 mb-2">Kund</div>
          {(() => {
            const cust = formatCustomer((o as any).customer);
            if (!cust) {
              return <div className="text-sm text-gray-500">—</div>;
            }
            return (
              <div className="text-sm text-gray-800 space-y-1">
                {cust.name && <div>{cust.name}</div>}
                {cust.email && <div>E-post: {cust.email}</div>}
                {cust.phone && <div>Telefon: {cust.phone}</div>}
                {!cust.email && !cust.phone && !cust.name && <div className="text-gray-500">—</div>}
                {cust.shipping && formatAddress(cust.shipping).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="text-gray-600 mb-0.5">Leveransadress</div>
                    {formatAddress(cust.shipping).map((line, i) => (
                      // eslint-disable-next-line react/no-array-index-key -- address lines have no IDs
                      <div key={`shipping-${i}-${line}`}>{line}</div>
                    ))}
                  </div>
                )}
                {cust.billing && formatAddress(cust.billing).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="text-gray-600 mb-0.5">Fakturaadress</div>
                    {formatAddress(cust.billing).map((line, i) => (
                      // eslint-disable-next-line react/no-array-index-key -- address lines have no IDs
                      <div key={`billing-${i}-${line}`}>{line}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
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
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  SKU
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Title
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Qty
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Unit
                </th>
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
