// Full-page order export: date range, presets, Orderfält + Radfält (two Excel sheets).

import { ArrowLeft, Download } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { navigateToPage } from '@/core/navigation/navigateToPage';

import { ordersApi } from '../api/ordersApi';

const HB = 'Homebase ordernummer';

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type DatePresetId = 'today' | 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth' | 'custom';

function applyPreset(id: DatePresetId): { from: string; to: string } {
  const now = new Date();
  const to = localYmd(now);
  if (id === 'today') {
    return { from: to, to };
  }
  if (id === 'last7') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { from: localYmd(start), to };
  }
  if (id === 'last30') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { from: localYmd(start), to };
  }
  if (id === 'last90') {
    const start = new Date(now);
    start.setDate(start.getDate() - 89);
    return { from: localYmd(start), to };
  }
  if (id === 'thisMonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: localYmd(start), to };
  }
  if (id === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: localYmd(start), to: localYmd(end) };
  }
  return { from: to, to };
}

const PRESETS: { id: DatePresetId; label: string }[] = [
  { id: 'today', label: 'Idag' },
  { id: 'last7', label: 'Senaste 7 dagarna' },
  { id: 'last30', label: 'Senaste 30 dagarna' },
  { id: 'last90', label: 'Senaste 90 dagarna' },
  { id: 'thisMonth', label: 'Denna månad' },
  { id: 'lastMonth', label: 'Förra månaden' },
];

export const OrderExportPage: React.FC = () => {
  const [orderFieldIds, setOrderFieldIds] = useState<string[]>([]);
  const [lineFieldIds, setLineFieldIds] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Set<string>>(() => new Set());
  const [selectedLine, setSelectedLine] = useState<Set<string>>(() => new Set());
  const [from, setFrom] = useState(() => applyPreset('last30').from);
  const [to, setTo] = useState(() => applyPreset('last30').to);
  const [preset, setPreset] = useState<DatePresetId>('last30');
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void ordersApi
      .getOrderExportFields()
      .then(({ orderFields, lineFields }) => {
        setOrderFieldIds(orderFields);
        setLineFieldIds(lineFields);
        setSelectedOrder(new Set(orderFields));
        setSelectedLine(new Set(lineFields));
      })
      .catch(() => {
        setErrorMessage('Kunde inte ladda fältlista.');
      });
  }, []);

  const toggleOrder = useCallback((id: string, checked: boolean) => {
    if (id === HB) {
      return;
    }
    setSelectedOrder((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      next.add(HB);
      return next;
    });
  }, []);

  const toggleLine = useCallback((id: string, checked: boolean) => {
    if (id === HB) {
      return;
    }
    setSelectedLine((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      next.add(HB);
      return next;
    });
  }, []);

  const applyPresetAndDates = useCallback((id: DatePresetId) => {
    setPreset(id);
    if (id !== 'custom') {
      const r = applyPreset(id);
      setFrom(r.from);
      setTo(r.to);
    }
  }, []);

  const onFromChange = useCallback((v: string) => {
    setPreset('custom');
    setFrom(v);
  }, []);

  const onToChange = useCallback((v: string) => {
    setPreset('custom');
    setTo(v);
  }, []);

  const orderSelectedCount = useMemo(
    () => orderFieldIds.filter((id) => selectedOrder.has(id)).length,
    [orderFieldIds, selectedOrder],
  );
  const lineSelectedCount = useMemo(
    () => lineFieldIds.filter((id) => selectedLine.has(id)).length,
    [lineFieldIds, selectedLine],
  );

  const runExport = async () => {
    setErrorMessage(null);
    const o = orderFieldIds.filter((id) => selectedOrder.has(id));
    const l = lineFieldIds.filter((id) => selectedLine.has(id));
    if (o.length === 0 && l.length === 0) {
      setErrorMessage('Välj minst ett fält.');
      return;
    }
    if (!from || !to) {
      setErrorMessage('Välj datum (från och till).');
      return;
    }

    setExporting(true);
    try {
      const blob = await ordersApi.downloadOrdersExportExcel({
        from,
        to,
        orderFields: o,
        lineFields: l,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setErrorMessage(String(err?.error || err?.message || e));
    } finally {
      setExporting(false);
    }
  };

  const loaded = orderFieldIds.length > 0 && lineFieldIds.length > 0;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-8 pb-16">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => navigateToPage('orders')}
        >
          <ArrowLeft className="w-4 h-4" />
          Tillbaka till ordrar
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exportera order</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Välj datumintervall och kolumner. Excel-filen har två blad: <strong>Order</strong> (en rad
          per order) och <strong>Rader</strong> (en rad per orderrad). Filtrering sker på{' '}
          <span className="font-mono">placed_at</span> (när ordern lades). Samma kolumnnamn som i
          bokföringsunderlaget. Homebase ordernummer ingår alltid i exporten för sortering.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2">
          {errorMessage}
        </div>
      )}

      <Card className="p-6 space-y-4 shadow-none border">
        <div className="text-sm font-medium">Period</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={preset === p.id ? 'default' : 'outline'}
              disabled={exporting}
              onClick={() => applyPresetAndDates(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="order-export-from">Från</Label>
            <input
              id="order-export-from"
              type="date"
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
              disabled={exporting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-export-to">Till</Label>
            <input
              id="order-export-to"
              type="date"
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={to}
              onChange={(e) => onToChange(e.target.value)}
              disabled={exporting}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Max 731 dagar per export. Ordrar utan <span className="font-mono">placed_at</span> ingår
          inte.
        </p>
      </Card>

      <Card className="p-6 space-y-4 shadow-none border">
        <div className="text-sm font-medium">Orderfält</div>
        <p className="text-xs text-muted-foreground">
          Uppgifter som gäller hela ordern (kund, betalning, m.m.). Valda fält blir kolumner på
          bladet Order ({orderSelectedCount} valda).
        </p>
        {!loaded ? (
          <p className="text-sm text-muted-foreground">Laddar…</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {orderFieldIds.map((id) => {
              const locked = id === HB;
              return (
                <div key={id} className="flex items-start gap-2">
                  <Checkbox
                    id={`order-f-${id}`}
                    checked={selectedOrder.has(id)}
                    onCheckedChange={(v) => toggleOrder(id, v === true)}
                    disabled={exporting || locked}
                  />
                  <Label
                    htmlFor={`order-f-${id}`}
                    className={`text-sm font-normal ${locked ? 'text-muted-foreground' : 'cursor-pointer'}`}
                  >
                    {id}
                    {locked ? ' (alltid med)' : ''}
                  </Label>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4 shadow-none border">
        <div className="text-sm font-medium">Radfält</div>
        <p className="text-xs text-muted-foreground">
          Uppgifter per orderrad (artiklar). Bladet Rader kan ha fler rader än Order (
          {lineSelectedCount} valda).
        </p>
        {!loaded ? (
          <p className="text-sm text-muted-foreground">Laddar…</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {lineFieldIds.map((id) => {
              const locked = id === HB;
              return (
                <div key={id} className="flex items-start gap-2">
                  <Checkbox
                    id={`line-f-${id}`}
                    checked={selectedLine.has(id)}
                    onCheckedChange={(v) => toggleLine(id, v === true)}
                    disabled={exporting || locked}
                  />
                  <Label
                    htmlFor={`line-f-${id}`}
                    className={`text-sm font-normal ${locked ? 'text-muted-foreground' : 'cursor-pointer'}`}
                  >
                    {id}
                    {locked ? ' (alltid med)' : ''}
                  </Label>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={exporting}
          onClick={() => navigateToPage('orders')}
        >
          Stäng
        </Button>
        <Button type="button" disabled={exporting || !loaded} onClick={() => void runExport()}>
          <Download className="w-4 h-4 mr-2" />
          {exporting ? 'Exporterar…' : 'Ladda ner Excel'}
        </Button>
      </div>
    </div>
  );
};
