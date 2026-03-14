import React, { useState } from 'react';

import { ordersApi } from '../api/ordersApi';
import { validateTrackingRequirement } from '../utils/validateTrackingRequirement';
import { getCarriersForChannel } from '../constants/carriers';
import type { OrderDetails, OrderItem, OrderStatus } from '../types/orders';
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

function customerLines(c: Record<string, unknown> | null | undefined): string[] {
  if (!c || typeof c !== 'object') {
    return [];
  }
  const parts: string[] = [];
  const email = (c.email as string) || (c.email_address as string);
  const phone = (c.phone as string) || (c.phone_mobile as string) || (c.phoneMobile as string);
  if (email) {
    parts.push(email);
  }
  if (phone) {
    parts.push(phone);
  }
  return parts;
}

function formatAddress(addr: any): string[] {
  if (!addr || typeof addr !== 'object') {
    return [];
  }
  const parts: string[] = [];

  // Fyndiq format: full_name, street_address, postal_code, city, country
  if (addr.full_name || addr.fullName) {
    parts.push(addr.full_name || addr.fullName);
  } else {
    // WooCommerce format: first_name, last_name, company, address_1, address_2, city, state, postcode, country
    const name = [addr.first_name, addr.last_name].filter(Boolean).join(' ').trim();
    if (name) {
      parts.push(name);
    }
    if (addr.company) {
      parts.push(addr.company);
    }
  }

  // Street address (Fyndiq) or address_1/address_2 (WooCommerce)
  if (addr.street_address || addr.streetAddress) {
    parts.push(addr.street_address || addr.streetAddress);
  } else {
    if (addr.address_1) {
      parts.push(addr.address_1);
    }
    if (addr.address_2) {
      parts.push(addr.address_2);
    }
  }

  const cityState = [addr.city, addr.state].filter(Boolean).join(', ').trim();
  const postal = addr.postcode || addr.postal_code || addr.postalCode;
  const location = [postal, cityState].filter(Boolean).join(' ').trim();
  if (location) {
    parts.push(location);
  }
  if (addr.country) {
    parts.push(addr.country);
  }

  return parts;
}

function normalizeRaw(raw: unknown): Record<string, any> | null {
  if (!raw) {
    return null;
  }
  if (typeof raw === 'object') {
    return raw as Record<string, any>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function toHref(value: unknown, mime: 'application/pdf' | 'text/plain'): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const v = value.trim();
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:')) {
    return v;
  }
  return `data:${mime};base64,${v}`;
}

const STATUS_OPTIONS: OrderStatus[] = ['processing', 'delivered', 'cancelled'];

export interface OrderDetailInlineProps {
  order: OrderDetails;
  onUpdated?: (order: OrderDetails) => void;
}

export const OrderDetailInline: React.FC<OrderDetailInlineProps> = ({ order, onUpdated }) => {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<OrderStatus>(order.status as OrderStatus);
  const [carrier, setCarrier] = useState(order.shippingCarrier ?? '');
  const [tracking, setTracking] = useState(order.shippingTrackingNumber ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorTrackingValidation, setSaveErrorTrackingValidation] = useState(false);

  const handleSave = (forceUpdate = false) => {
    setSaveError(null);
    setSaveErrorTrackingValidation(false);

    const trackingErr = validateTrackingRequirement(order, status, tracking.trim() || undefined);
    if (trackingErr && !forceUpdate) {
      setSaveError(trackingErr.message);
      setSaveErrorTrackingValidation(true);
      return;
    }

    const next: OrderDetails = {
      ...order,
      status,
      shippingCarrier: carrier.trim() || undefined,
      shippingTrackingNumber: tracking.trim() || undefined,
      items: order.items,
      customer: order.customer,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
    };
    onUpdated?.(next);
    setEditing(false);

    ordersApi
      .updateStatus(
        order.id,
        {
          status,
          carrier: carrier.trim() || undefined,
          trackingNumber: tracking.trim() || undefined,
        },
        forceUpdate ? { forceUpdate: true } : undefined,
      )
      .catch((e: any) => {
        console.error('Update order status failed (background):', e);
      });
  };

  const lines = customerLines(order.customer as Record<string, unknown>);
  const hasCustomer = lines.length > 0;
  const raw = normalizeRaw(order.raw);
  const labels = raw?.shipping_labels || null;
  const pdfHref = toHref(labels?.pdf, 'application/pdf');
  const zplHref = toHref(labels?.zpl, 'text/plain');

  return (
    <div className="p-4 sm:p-6 space-y-4 bg-gray-50 border-t border-gray-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-gray-500">
            {order.channelLabel !== null &&
            order.channelLabel !== undefined &&
            String(order.channelLabel).trim() !== ''
              ? String(order.channelLabel).trim()
              : '—'}
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {order.platformOrderNumber || order.channelOrderId || 'Order'}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {fmtDate(order.placedAt)} · {fmtMoney(order.totalAmount, order.currency)}
            {order.items?.some(
              (it) =>
                it.unitPrice !== null &&
                it.unitPrice !== undefined &&
                Number.isFinite(Number(it.unitPrice)),
            )
              ? ' inkl. moms'
              : ''}
          </div>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm"
          >
            Edit status
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {saveError && (
              <>
                <span className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-900">
                  {saveError}
                </span>
                {saveErrorTrackingValidation && (
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    className="px-3 py-2 rounded-md border border-red-300 bg-white text-red-800 hover:bg-red-100 text-sm"
                  >
                    Uppdatera ändå
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => handleSave()}
              className="px-3 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-800 text-sm"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setSaveError(null);
                setSaveErrorTrackingValidation(false);
                setStatus(order.status as OrderStatus);
                setCarrier(order.shippingCarrier ?? '');
                setTracking(order.shippingTrackingNumber ?? '');
              }}
              className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Shipping Address */}
            {(order.shippingAddress || (order.customer as any)?.shippingAddress) && (
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1">Shipping Address</div>
                <div className="text-sm text-gray-700 space-y-0.5">
                  {formatAddress(
                    order.shippingAddress || (order.customer as any)?.shippingAddress,
                  ).map((line) => (
                    <div key={`shipping-${line}`}>{line}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Billing Address */}
            {(order.billingAddress || (order.customer as any)?.billingAddress) && (
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1">Billing Address</div>
                <div className="text-sm text-gray-700 space-y-0.5">
                  {formatAddress(
                    order.billingAddress || (order.customer as any)?.billingAddress,
                  ).map((line) => (
                    <div key={`billing-${line}`}>{line}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Contact Info */}
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Contact</div>
              {hasCustomer ? (
                <div className="text-sm text-gray-700 space-y-0.5">
                  {lines.map((line) => (
                    <div key={`contact-${line}`}>{line}</div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">—</div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-sm font-semibold text-gray-900 mb-2">Status</div>
          {editing ? (
            <div className="space-y-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md bg-white text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {statusDisplayLabel(s)}
                  </option>
                ))}
              </select>
              {(() => {
                const carriers = getCarriersForChannel(order.channel);
                if (carriers.length > 0) {
                  return (
                    <select
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md bg-white text-sm"
                    >
                      <option value="">—</option>
                      {carriers.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  );
                }
                return (
                  <input
                    type="text"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder="Carrier"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                );
              })()}
              <input
                type="text"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="Tracking number"
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-sm text-gray-800">
                <span className="text-gray-500">Status:</span> {statusDisplayLabel(order.status)}
              </div>
              <div className="text-sm text-gray-800">
                <span className="text-gray-500">Carrier:</span> {order.shippingCarrier || '—'}
              </div>
              <div className="text-sm text-gray-800">
                <span className="text-gray-500">Tracking:</span>{' '}
                {order.shippingTrackingNumber || '—'}
              </div>
              {(pdfHref || zplHref) && (
                <div className="pt-2 flex flex-wrap gap-2">
                  {pdfHref && (
                    <a
                      href={pdfHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-xs"
                    >
                      Ladda ner PDF
                    </a>
                  )}
                  {zplHref && (
                    <a
                      href={zplHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-xs"
                    >
                      Ladda ner ZPL
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {order.items?.length ? (
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
                  Antal
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  À pris (inkl. moms)
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Radsumma
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.items.map((it: OrderItem) => {
                const unitPrice =
                  it.unitPrice !== null &&
                  it.unitPrice !== undefined &&
                  Number.isFinite(Number(it.unitPrice))
                    ? Number(it.unitPrice)
                    : null;
                const qty = Number(it.quantity) || 0;
                const lineTotal = unitPrice !== null && qty > 0 ? unitPrice * qty : null;
                return (
                  <tr key={it.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">{it.sku || '—'}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{it.title || '—'}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{it.quantity}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">
                      {unitPrice !== null ? fmtMoney(unitPrice, order.currency) : '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">
                      {lineTotal !== null ? fmtMoney(lineTotal, order.currency) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-gray-500">No items.</div>
      )}
    </div>
  );
};
