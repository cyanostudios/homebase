// Dedicated full-page product import (replaces modal on ProductList).

import { ArrowLeft, Upload } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { navigateToPage } from '@/core/navigation/navigateToPage';

import type { ProductImportMode } from '../api/productsApi';
import { useProducts } from '../hooks/useProducts';

export const ProductImportPage: React.FC = () => {
  const { importProducts, clearProductSelection } = useProducts();
  const [importMode, setImportMode] = useState<ProductImportMode>('upsert');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<any | null>(null);

  const runImportFlow = async () => {
    if (!importFile) {
      return;
    }
    setImporting(true);
    try {
      const resp = await importProducts(importFile, importMode);
      setLastImportResult(resp);
      clearProductSelection();
    } catch (err: any) {
      console.error('Import failed:', err);
      setLastImportResult({
        ok: false,
        error: String(err?.message || err?.error || err),
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
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
          Ladda upp en .csv- eller .xlsx-fil och välj hur den ska tillämpas.
        </p>
      </div>

      <Card className="p-6 space-y-6 shadow-none border">
        <div className="space-y-2">
          <div className="text-sm font-medium">Läge</div>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as ProductImportMode)}
            disabled={importing}
          >
            <option value="upsert">Upsert (uppdatera om SKU finns, annars skapa)</option>
            <option value="update-only">Endast uppdatera (hoppa nya SKU)</option>
            <option value="create-only">Endast skapa (hoppa befintliga SKU)</option>
          </select>
          <div className="text-xs text-muted-foreground">
            SKU krävs alltid. Utan <span className="font-mono">issello=1</span>: använd per-marknad{' '}
            <span className="font-mono">title.se</span>, <span className="font-mono">description.se</span>, samma
            för <span className="font-mono">.dk</span>, <span className="font-mono">.fi</span>,{' '}
            <span className="font-mono">.no</span>. Importerade värden ersätter befintliga Texter för de celler som
            fylls i. Katalog <span className="font-mono">title</span> / <span className="font-mono">description</span>{' '}
            och <span className="font-mono">textsStandard</span> följer <strong>svenska (se)</strong> som standard;
            valfri kolumn <span className="font-mono">textsStandard</span> kan sätta annan marknad (t.ex.{' '}
            <span className="font-mono">fi</span> — då krävs kompletta finska texter). Generiska{' '}
            <span className="font-mono">title</span> / <span className="font-mono">description</span> ignoreras.
            Sello: <span className="font-mono">issello</span>=1 och Sellos kolumnnamn.
          </div>
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

        {lastImportResult && (
          <div className="rounded-md border p-3 text-sm">
            {lastImportResult.ok === false ? (
              <div className="text-red-700">
                Import misslyckades: {String(lastImportResult.error || 'Okänt fel')}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="font-medium">Resultat</div>
                <div className="text-xs text-muted-foreground">
                  Läge: {lastImportResult.mode} · Rader: {lastImportResult.totalRows}
                </div>
                <div>
                  Skapade: {lastImportResult.created} · Uppdaterade: {lastImportResult.updated}
                </div>
                <div className="text-xs text-muted-foreground">
                  Saknad SKU:{' '}
                  {Array.isArray(lastImportResult.skippedMissingSku)
                    ? lastImportResult.skippedMissingSku.length
                    : 0}
                  {' · '}
                  Ogiltiga:{' '}
                  {Array.isArray(lastImportResult.skippedInvalid)
                    ? lastImportResult.skippedInvalid.length
                    : 0}
                  {' · '}
                  Konflikter:{' '}
                  {Array.isArray(lastImportResult.conflicts) ? lastImportResult.conflicts.length : 0}
                  {' · '}
                  Hittades ej:{' '}
                  {Array.isArray(lastImportResult.notFound) ? lastImportResult.notFound.length : 0}
                </div>
              </div>
            )}
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
          <Button type="button" disabled={importing || !importFile} onClick={runImportFlow}>
            <Upload className="w-4 h-4 mr-2" />
            {importing ? 'Importerar…' : 'Importera'}
          </Button>
        </div>
      </Card>
    </div>
  );
};
