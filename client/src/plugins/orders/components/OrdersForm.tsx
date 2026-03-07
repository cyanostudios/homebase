import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getCarriersForChannel } from '../constants/carriers';
import { useOrders } from '../hooks/useOrders';
import type { OrderStatus } from '../types/orders';

interface OrdersFormProps {
  onSave: (data: any) => Promise<boolean>;
  onCancel: () => void;
}

const STATUSES: Array<{ value: OrderStatus; label: string }> = [
  { value: 'processing', label: 'Processing' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const OrdersForm: React.FC<OrdersFormProps> = ({ onSave, onCancel }) => {
  const { currentOrder, validationErrors, clearValidationErrors } = useOrders();
  const [isSaving, setIsSaving] = useState(false);

  const initial = useMemo(
    () => ({
      status: (currentOrder?.status as OrderStatus) || 'processing',
      carrier: currentOrder?.shippingCarrier || '',
      trackingNumber: currentOrder?.shippingTrackingNumber || '',
    }),
    [currentOrder?.status, currentOrder?.shippingCarrier, currentOrder?.shippingTrackingNumber],
  );

  const [formData, setFormData] = useState(initial);

  useEffect(() => {
    setFormData(initial);
  }, [initial]);

  const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);
  const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

  const handleSave = useCallback(async () => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    clearValidationErrors();
    try {
      const ok = await onSave(formData);
      if (!ok) {
        setIsSaving(false);
      }
    } catch {
      setIsSaving(false);
    }
  }, [clearValidationErrors, formData, isSaving, onSave]);

  useEffect(() => {
    const onSubmit = () => void handleSave();
    const onCancelEvent = () => onCancel();
    window.addEventListener('submitOrderForm', onSubmit);
    window.addEventListener('cancelOrderForm', onCancelEvent);
    return () => {
      window.removeEventListener('submitOrderForm', onSubmit);
      window.removeEventListener('cancelOrderForm', onCancelEvent);
    };
  }, [handleSave, onCancel]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <div className="text-lg font-semibold text-gray-900">Update order status</div>
        <div className="text-sm text-gray-500 mt-1">
          {currentOrder
            ? `${currentOrder.channel} · ${currentOrder.channelOrderId}`
            : 'No order selected'}
        </div>
      </div>

      {hasBlockingErrors ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-sm font-medium text-red-800">Please fix the following errors:</div>
          <ul className="mt-2 text-sm text-red-700 list-disc pl-5">
            {validationErrors
              .filter((e) => !e.message.includes('Warning'))
              .map((e) => (
                <li key={e.field + ':' + e.message}>{e.message}</li>
              ))}
          </ul>
        </div>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as OrderStatus }))}
            className={`w-full px-3 py-2 border rounded-md ${
              getFieldError('status') ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSaving}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {getFieldError('status') ? (
            <p className="mt-1 text-sm text-red-600">{getFieldError('status')?.message}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
            {(() => {
              const carriers = getCarriersForChannel(currentOrder?.channel ?? '');
              if (carriers.length > 0) {
                return (
                  <select
                    value={formData.carrier}
                    onChange={(e) => setFormData((p) => ({ ...p, carrier: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-md bg-white ${getFieldError('carrier') ? 'border-red-500' : 'border-gray-300'}`}
                    disabled={isSaving}
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
                  value={formData.carrier}
                  onChange={(e) => setFormData((p) => ({ ...p, carrier: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-md ${getFieldError('carrier') ? 'border-red-500' : 'border-gray-300'}`}
                  disabled={isSaving}
                />
              );
            })()}
            {getFieldError('carrier') ? (
              <p className="mt-1 text-sm text-red-600">{getFieldError('carrier')?.message}</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tracking number</label>
            <input
              value={formData.trackingNumber}
              onChange={(e) => setFormData((p) => ({ ...p, trackingNumber: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md ${
                getFieldError('trackingNumber') ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isSaving}
            />
            {getFieldError('trackingNumber') ? (
              <p className="mt-1 text-sm text-red-600">
                {getFieldError('trackingNumber')?.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-800"
            disabled={isSaving}
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};
