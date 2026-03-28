import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { productsApi } from '@/plugins/products/api/productsApi';

type JobRow = {
  id: string;
  status: string;
  totalProducts: number;
  processedDb: number;
  processedChannels: number;
  errors: unknown[];
  createdAt: string;
  completedAt: string | null;
  triggerSource: string;
};

export const BatchSyncStatusModal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productsApi.listBatchSyncJobs();
      setJobs((res.jobs || []) as JobRow[]);
    } catch (e: any) {
      setError(e?.message || 'Kunde inte ladda synkstatus');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    void load();
    const t = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(t);
  }, [open, load]);

  const active = jobs.find(
    (j) =>
      (j.status === 'running' || j.status === 'pending') &&
      (j.completedAt === null || j.completedAt === undefined || j.completedAt === ''),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          {active ? 'Synkar…' : 'Synkstatus'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Produktsynk (batch / lager)</DialogTitle>
        </DialogHeader>
        {loading && jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Laddar…</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {active ? (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">Pågår</p>
            <p className="text-muted-foreground">
              DB: {active.processedDb} / {active.totalProducts} — Kanaler:{' '}
              {active.processedChannels} / {active.totalProducts}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Stänger inte servern om du stänger.
            </p>
          </div>
        ) : null}
        <div className="space-y-2">
          <p className="text-sm font-medium">Senaste jobb (max 50)</p>
          <ul className="space-y-2 text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="border rounded p-2">
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-xs truncate">{j.id}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{j.status}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(j.createdAt).toLocaleString()} — {j.triggerSource}
                </div>
                <div className="text-xs mt-1">
                  DB {j.processedDb}/{j.totalProducts} · Kanal {j.processedChannels}/
                  {j.totalProducts}
                  {j.completedAt ? ` · klar ${new Date(j.completedAt).toLocaleString()}` : ''}
                </div>
                {Array.isArray(j.errors) && j.errors.length > 0 ? (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer">Fel ({j.errors.length})</summary>
                    <ul className="mt-1 space-y-1 list-disc pl-4">
                      {(j.errors as any[]).map((e) => (
                        <li
                          key={`${j.id}-${String(e?.productId ?? '')}-${String(e?.channel ?? '')}-${String(e?.message ?? e?.error ?? '')}`}
                        >
                          {e?.productId !== undefined && e?.productId !== null
                            ? `${e.productId} `
                            : ''}
                          {e?.channel ? `${e.channel}: ` : ''}
                          {String(e?.message || e?.error || JSON.stringify(e))}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <Button variant="secondary" size="sm" type="button" onClick={() => void load()}>
          Uppdatera
        </Button>
      </DialogContent>
    </Dialog>
  );
};
