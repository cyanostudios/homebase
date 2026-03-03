import React from 'react';

import type { AnalyticsDrilldownOrderItem } from '../types/analytics';
import { moneyFmt } from '../utils/formatters';

function fmtDate(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    return v;
  }
  return d.toLocaleDateString('sv-SE');
}

type Props = {
  orders: AnalyticsDrilldownOrderItem[];
  emptyMessage: string;
  loading?: boolean;
  onOrderClick: (id: string) => void;
};

export function DrilldownOrderList({ orders, emptyMessage, loading, onOrderClick }: Props) {
  if (loading) {
    return <div className="text-gray-500">Laddar…</div>;
  }
  if (orders.length === 0) {
    return <div className="text-gray-500">{emptyMessage}</div>;
  }
  return (
    <div className="space-y-2 text-sm">
      {orders.map((o) => (
        <div
          key={o.id}
          className="flex items-center justify-between border-b pb-1 cursor-pointer hover:bg-gray-50"
          onClick={() => onOrderClick(o.id)}
        >
          <div>
            <div className="font-medium">Order #{o.orderNumber ?? o.id}</div>
            <div className="text-gray-500">
              {fmtDate(o.placedAt)} · {o.channelLabel || o.channel} · {o.status}
            </div>
          </div>
          <div className="font-medium">{moneyFmt(o.totalAmount || 0, o.currency || 'SEK')}</div>
        </div>
      ))}
    </div>
  );
}
