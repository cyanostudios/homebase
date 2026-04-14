// Full-page product export to Excel (column picker + list + channel filters).

import { ArrowLeft, Download } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { navigateToPage } from '@/core/navigation/navigateToPage';
import { channelsApi } from '@/plugins/channels/api/channelsApi';
import type { ChannelInstance } from '@/plugins/channels/types/channels';

import {
  productsApi,
  type ExportColumnReferenceResponse,
  type ProductExportRequestBody,
} from '../api/productsApi';

function instanceLabel(inst: {
  channel: string;
  instanceKey: string;
  label: string | null;
  market: string | null;
  id: string;
}): string {
  const bits = [inst.channel, inst.instanceKey, inst.market, inst.label].filter(Boolean);
  return bits.length ? `${bits.join(' · ')} (#${inst.id})` : `#${inst.id}`;
}

export const ProductExportPage: React.FC = () => {
  const [columnRef, setColumnRef] = useState<ExportColumnReferenceResponse | null>(null);
  const [lists, setLists] = useState<
    Array<{ id: string; name: string; namespace: string; createdAt: string; updatedAt: string }>
  >([]);
  const [instances, setInstances] = useState<ChannelInstance[]>([]);
  const [listValue, setListValue] = useState<string>('all');
  const [selectedGeneral, setSelectedGeneral] = useState<Set<string>>(
    () => new Set(['sku', 'id', 'title', 'quantity', 'priceAmount']),
  );
  const [selectedChannelHeaders, setSelectedChannelHeaders] = useState<Set<string>>(
    () => new Set(),
  );
  const [filterInstanceIds, setFilterInstanceIds] = useState<Set<number>>(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void productsApi
      .getExportColumnReference()
      .then(setColumnRef)
      .catch(() => {
        void 0;
      });
    void productsApi
      .getLists()
      .then((rows) => setLists(rows || []))
      .catch(() => {
        void 0;
      });
    void channelsApi
      .getInstances({ includeDisabled: true })
      .then((r) => setInstances(r.items || []))
      .catch(() => {
        void 0;
      });
  }, []);

  const enabledInstances = useMemo(() => instances.filter((i) => i.enabled !== false), [instances]);

  const generalByGroup = useMemo(() => {
    const g = columnRef?.general ?? [];
    const map = new Map<string, typeof g>();
    for (const col of g) {
      const key = col.group || 'Övrigt';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(col);
    }
    return map;
  }, [columnRef]);

  const columnChannelInstanceIds = useMemo(() => {
    const keys = columnRef?.channelColumns ?? [];
    const ids = new Set<number>();
    for (const hk of selectedChannelHeaders) {
      for (const row of keys) {
        if (row.fields?.some((f) => f.headerKey === hk)) {
          const n = Number(row.instanceId);
          if (Number.isFinite(n)) {
            ids.add(n);
          }
          break;
        }
      }
    }
    return Array.from(ids).sort((a, b) => a - b);
  }, [columnRef, selectedChannelHeaders]);

  const toggleGeneral = useCallback((id: string, checked: boolean) => {
    setSelectedGeneral((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const toggleChannelField = useCallback((headerKey: string, checked: boolean) => {
    setSelectedChannelHeaders((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(headerKey);
      } else {
        next.delete(headerKey);
      }
      return next;
    });
  }, []);

  const toggleFilterInstance = useCallback((id: number, checked: boolean) => {
    setFilterInstanceIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const runExport = async () => {
    setErrorMessage(null);
    const generalIds = Array.from(selectedGeneral);
    const channelIds = Array.from(selectedChannelHeaders);
    const columnIds = [...generalIds, ...channelIds];
    if (!columnIds.length) {
      setErrorMessage('Välj minst en kolumn.');
      return;
    }

    const body: ProductExportRequestBody = {
      columnIds,
      list: listValue,
      filterChannelInstanceIds: Array.from(filterInstanceIds).sort((a, b) => a - b),
      columnChannelInstanceIds,
    };

    setExporting(true);
    try {
      const blob = await productsApi.exportProductsToExcel(body);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setErrorMessage(String(err?.error || err?.message || e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-8 pb-16">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => navigateToPage('products')}
        >
          <ArrowLeft className="w-4 h-4" />
          Tillbaka till produkter
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exportera produkter</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Välj kolumner och eventuella filter. Excel-filen genereras direkt (ingen bakgrundskö).
          Kanalkolumner följer samma namn som import (t.ex.{' '}
          <span className="font-mono">woocommerce.11.price</span>
          ).
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2">
          {errorMessage}
        </div>
      )}

      <Card className="p-6 space-y-6 shadow-none border">
        <div className="space-y-2">
          <div className="text-sm font-medium">Lista</div>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={listValue}
            onChange={(e) => setListValue(e.target.value)}
            disabled={exporting}
          >
            <option value="all">Alla produkter</option>
            <option value="main">Utan lista</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Samma listlogik som i produktkatalogen (en produkt kan bara visas en gång; vid flera
            listor väljs första list-id deterministiskt).
          </p>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Filtrera på kanal (aktiva produkter)</div>
          <p className="text-xs text-muted-foreground">
            Tomt = alla produkter som matchar listan ovan. Markerade = produkten måste vara aktiv (
            <span className="font-mono">enabled</span>) på minst en av de valda kanalinstanserna.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {enabledInstances.map((inst) => {
              const id = Number(inst.id);
              return (
                <div key={inst.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`filter-${inst.id}`}
                    checked={filterInstanceIds.has(id)}
                    onCheckedChange={(v) => toggleFilterInstance(id, v === true)}
                    disabled={exporting}
                  />
                  <Label
                    htmlFor={`filter-${inst.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {instanceLabel(inst)}
                  </Label>
                </div>
              );
            })}
            {enabledInstances.length === 0 && (
              <p className="text-sm text-muted-foreground">Inga aktiverade kanalinstanser.</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-6 shadow-none border">
        <div className="text-sm font-medium">Kolumner</div>
        {!columnRef ? (
          <p className="text-sm text-muted-foreground">Laddar kolumnreferens…</p>
        ) : (
          <div className="space-y-6">
            {Array.from(generalByGroup.entries()).map(([groupName, cols]) => (
              <div key={groupName} className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {groupName}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {cols.map((col) => (
                    <div key={col.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`g-${col.id}`}
                        checked={selectedGeneral.has(col.id)}
                        onCheckedChange={(v) => toggleGeneral(col.id, v === true)}
                        disabled={exporting}
                      />
                      <div className="space-y-0.5">
                        <Label
                          htmlFor={`g-${col.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {col.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{col.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="space-y-3 pt-2 border-t">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Kanalkolumner (per instans)
              </div>
              <p className="text-xs text-muted-foreground">
                Bocka fält för varje kanalinstans du vill exportera. Kräver att motsvarande data
                finns i overrides eller <span className="font-mono">channel_specific</span>.
              </p>
              {(columnRef.channelColumns || [])
                .filter((row) => row.enabled !== false)
                .map((row) => (
                  <div key={row.instanceId} className="rounded-md border p-3 space-y-2">
                    <div className="text-sm font-medium">
                      {instanceLabel({
                        id: row.instanceId,
                        channel: row.channel,
                        instanceKey: row.instanceKey,
                        market: row.market,
                        label: row.label,
                      })}
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {(row.fields || []).map((f) => (
                        <div key={f.headerKey} className="flex items-center gap-2">
                          <Checkbox
                            id={`ch-${f.headerKey}`}
                            checked={selectedChannelHeaders.has(f.headerKey)}
                            onCheckedChange={(v) => toggleChannelField(f.headerKey, v === true)}
                            disabled={exporting}
                          />
                          <Label
                            htmlFor={`ch-${f.headerKey}`}
                            className="text-sm font-normal cursor-pointer font-mono text-xs"
                          >
                            {f.headerKey}
                          </Label>
                          <span className="text-xs text-muted-foreground">({f.label})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={exporting}
          onClick={() => navigateToPage('products')}
        >
          Stäng
        </Button>
        <Button type="button" disabled={exporting || !columnRef} onClick={() => void runExport()}>
          <Download className="w-4 h-4 mr-2" />
          {exporting ? 'Exporterar…' : 'Ladda ner Excel'}
        </Button>
      </div>
    </div>
  );
};
