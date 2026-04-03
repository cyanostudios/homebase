// Dedicated full-page product import (replaces modal on ProductList).

import { ArrowLeft, ChevronDown, Copy, Upload } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { navigateToPage } from '@/core/navigation/navigateToPage';
import { channelsApi } from '@/plugins/channels/api/channelsApi';
import type { ChannelInstance } from '@/plugins/channels/types/channels';

import {
  productsApi,
  type ImportColumnReferenceResponse,
  type ProductImportJobSnapshot,
  type ProductImportMatchKey,
  type ProductImportMode,
} from '../api/productsApi';
import { useProducts } from '../hooks/useProducts';

function copyText(text: string) {
  void navigator.clipboard.writeText(text).catch(() => {
    void 0;
  });
}

export const ProductImportPage: React.FC = () => {
  const { reloadProducts, clearProductSelection } = useProducts();
  const [importMode, setImportMode] = useState<ProductImportMode>('upsert');
  const [matchKey, setMatchKey] = useState<ProductImportMatchKey>('sku');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [liveJob, setLiveJob] = useState<ProductImportJobSnapshot | null>(null);
  const [lastJob, setLastJob] = useState<ProductImportJobSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [history, setHistory] = useState<ProductImportJobSnapshot[]>([]);
  const [columnRef, setColumnRef] = useState<ImportColumnReferenceResponse | null>(null);
  const [lists, setLists] = useState<
    Array<{ id: string; name: string; namespace: string; createdAt: string; updatedAt: string }>
  >([]);
  const [listFilter, setListFilter] = useState('');
  const [instances, setInstances] = useState<ChannelInstance[]>([]);
  const [instFilter, setInstFilter] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const { items } = await productsApi.getImportHistory();
      setHistory(items || []);
    } catch {
      void 0;
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    void productsApi
      .getImportColumnReference()
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
  }, [loadHistory]);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const filteredLists = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    if (!q) {
      return lists;
    }
    return lists.filter(
      (l) =>
        String(l.name).toLowerCase().includes(q) ||
        String(l.id).toLowerCase().includes(q) ||
        String(l.namespace || '')
          .toLowerCase()
          .includes(q),
    );
  }, [lists, listFilter]);

  const filteredInstances = useMemo(() => {
    const q = instFilter.trim().toLowerCase();
    if (!q) {
      return instances;
    }
    return instances.filter((i) => {
      const hay = [i.id, i.channel, i.instanceKey, i.label, i.market]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [instances, instFilter]);

  const runImportFlow = async () => {
    if (!importFile) {
      return;
    }
    setErrorMessage(null);
    setLastJob(null);
    setLiveJob(null);
    setImporting(true);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    try {
      const started = await productsApi.startProductImport(importFile, importMode, matchKey);

      const finishOk = async (job: ProductImportJobSnapshot) => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setImporting(false);
        setLastJob(job);
        setLiveJob(null);
        await reloadProducts();
        clearProductSelection();
        await loadHistory();
      };

      let terminal = false;
      const pollOnce = async (): Promise<void> => {
        try {
          const { job } = await productsApi.getImportJob(started.jobId);
          setLiveJob(job);
          if (job.status === 'completed' || job.status === 'failed') {
            terminal = true;
            await finishOk(job);
          }
        } catch (e: any) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setImporting(false);
          setErrorMessage(String(e?.message || e));
          terminal = true;
        }
      };

      await pollOnce();
      if (!terminal) {
        pollRef.current = setInterval(() => void pollOnce(), 750);
      }
    } catch (err: any) {
      setImporting(false);
      setErrorMessage(String(err?.message || err?.error || err));
    }
  };

  const downloadFile = async (jobId: string, filename: string) => {
    try {
      const blob = await productsApi.downloadImportFile(jobId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'import';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErrorMessage(String(e?.message || e));
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
        <h1 className="text-2xl font-semibold tracking-tight">Importera produkter</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ladda upp en .csv- eller .xlsx-fil. Importen körs i bakgrunden; räknare uppdateras medan
          jobbet körs.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2">
          {errorMessage}
        </div>
      )}

      <Card className="p-6 space-y-6 shadow-none border">
        <div className="space-y-2">
          <div className="text-sm font-medium">Läge</div>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as ProductImportMode)}
            disabled={importing}
          >
            <option value="upsert">Upsert (uppdatera om match finns, annars skapa)</option>
            <option value="update-only">Endast uppdatera</option>
            <option value="create-only">Endast skapa</option>
          </select>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Matchnyckel</div>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={matchKey}
            onChange={(e) => setMatchKey(e.target.value as ProductImportMatchKey)}
            disabled={importing}
          >
            <option value="sku">SKU</option>
            <option value="id">Produkt-ID</option>
            <option value="gtin">GTIN</option>
            <option value="ean">EAN</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Vid GTIN/EAN och dubbletter i databasen används den produkt som har lägst id. För
            Sello-rader mappas <span className="font-mono">propertygtin</span> /{' '}
            <span className="font-mono">propertyean</span> till samma fält.
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Fil</div>
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={importing}
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
          />
          {importFile && (
            <div className="text-xs text-muted-foreground">
              Vald fil: <span className="font-mono">{importFile.name}</span>
            </div>
          )}
        </div>

        {(importing || liveJob) && liveJob && (
          <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/40">
            <div className="font-medium">Körning</div>
            <div className="text-xs text-muted-foreground">
              Status: {liveJob.status} · Match: {liveJob.matchKey}
            </div>
            <div>
              Rader: {liveJob.processedRows} / {liveJob.totalRows} · Skapade: {liveJob.createdCount}{' '}
              · Uppdaterade: {liveJob.updatedCount} · Fel/radproblem: {liveJob.errorCount}
            </div>
          </div>
        )}

        {lastJob && !importing && !liveJob && (
          <div className="rounded-md border p-3 text-sm space-y-1">
            <div className="font-medium">Senaste resultat</div>
            <div className="text-xs text-muted-foreground">
              Status: {lastJob.status}
              {lastJob.lastError ? ` · ${lastJob.lastError}` : ''}
            </div>
            <div>
              Rader: {lastJob.totalRows} · Skapade: {lastJob.createdCount} · Uppdaterade:{' '}
              {lastJob.updatedCount} · Fel/radproblem: {lastJob.errorCount}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={importing}
            onClick={() => navigateToPage('products')}
          >
            Stäng
          </Button>
          <Button
            type="button"
            disabled={importing || !importFile}
            onClick={() => void runImportFlow()}
          >
            <Upload className="w-4 h-4 mr-2" />
            {importing ? 'Importerar…' : 'Importera'}
          </Button>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Historik (senaste 5)</h2>
        <Card className="shadow-none border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tid</TableHead>
                <TableHead>Fil</TableHead>
                <TableHead className="hidden sm:table-cell">Kolumner</TableHead>
                <TableHead className="text-right">Resultat</TableHead>
                <TableHead className="w-[100px] text-right">Fil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-sm">
                    Ingen historik ännu.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell
                      className="text-sm max-w-[180px] truncate"
                      title={h.originalFilename}
                    >
                      {h.originalFilename || '—'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs max-w-[220px]">
                      <span className="line-clamp-2">
                        {(h.detectedHeaders || []).slice(0, 8).join(', ')}
                        {(h.detectedHeaders || []).length > 8 ? '…' : ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">
                      +{h.createdCount} / ~{h.updatedCount} · fel {h.errorCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => void downloadFile(h.id, h.originalFilename)}
                      >
                        Ladda ner
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Kolumnreferens</h2>
        {!columnRef ? (
          <p className="text-sm text-muted-foreground">Laddar…</p>
        ) : (
          <div className="space-y-2">
            <RefCollapsible title="Allmänna kolumner" defaultOpen>
              <ColumnTable rows={columnRef.general} />
            </RefCollapsible>
            <RefCollapsible title="Sello (issello=1)">
              <ColumnTable rows={columnRef.sello} />
            </RefCollapsible>
            {columnRef.channels.map((ch) => (
              <RefCollapsible
                key={`${ch.channel}-${ch.instanceKey}-${ch.numericId}`}
                title={`${ch.channel} · ${ch.instanceKey}`}
              >
                <div className="text-xs text-muted-foreground mb-2 space-y-1">
                  <div>
                    Instans-ID: <span className="font-mono">{ch.numericId}</span>
                    {ch.label ? ` · ${ch.label}` : ''}
                    {ch.market ? ` · marknad ${ch.market}` : ''}
                  </div>
                  <div className="font-medium text-foreground pt-1">Punktnotation</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {ch.exampleColumns.map((c) => (
                      <li key={c} className="flex items-center gap-2 flex-wrap">
                        <code className="font-mono text-xs bg-muted px-1 rounded">{c}</code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyText(c)}
                          aria-label="Kopiera"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {ch.legacyHints.length > 0 && (
                    <>
                      <div className="font-medium text-foreground pt-2">Legacy (Sello-lik)</div>
                      <ul className="list-disc pl-4 space-y-1">
                        {ch.legacyHints.map((c) => (
                          <li key={c} className="flex items-center gap-2 flex-wrap">
                            <code className="font-mono text-xs bg-muted px-1 rounded">{c}</code>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyText(c)}
                              aria-label="Kopiera"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </RefCollapsible>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Mappar</h2>
        <Input
          placeholder="Filtrera på namn eller id…"
          value={listFilter}
          onChange={(e) => setListFilter(e.target.value)}
          className="max-w-md"
        />
        <Card className="shadow-none border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">ID</TableHead>
                <TableHead>Namn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLists.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">{l.id}</TableCell>
                  <TableCell>{l.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Kanalinstanser</h2>
        <Input
          placeholder="Filtrera…"
          value={instFilter}
          onChange={(e) => setInstFilter(e.target.value)}
          className="max-w-md"
        />
        <Card className="shadow-none border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead className="w-[100px]">Kanal</TableHead>
                <TableHead>Namn</TableHead>
                <TableHead className="w-[140px]">instanceKey</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInstances.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.id}</TableCell>
                  <TableCell>{i.channel}</TableCell>
                  <TableCell>{i.label || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{i.instanceKey}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
};

function RefCollapsible({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="shadow-none border">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
          >
            {title}
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 border-t">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function ColumnTable({ rows }: { rows: Array<{ name: string; description: string }> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">Namn</TableHead>
          <TableHead>Beskrivning</TableHead>
          <TableHead className="w-[48px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.name}>
            <TableCell>
              <code className="font-mono text-xs">{r.name}</code>
            </TableCell>
            <TableCell className="text-sm">{r.description}</TableCell>
            <TableCell>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => copyText(r.name)}
                aria-label="Kopiera kolumnnamn"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
