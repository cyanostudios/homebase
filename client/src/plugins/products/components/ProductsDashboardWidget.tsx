import { ChevronRight } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';

import { productsApi } from '../api/productsApi';

export function ProductsDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    productsApi
      .getProductCount()
      .then((n) => {
        if (!cancelled) {
          setCount(n);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Kunde inte hämta antal');
          setCount(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal produkter: <strong>{error ? '—' : count === null ? '…' : count}</strong>
        {error ? <span className="text-destructive"> ({error})</span> : null}
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto px-0 text-primary hover:bg-transparent hover:text-primary/90"
        onClick={(e) => {
          e.stopPropagation();
          onOpenPlugin();
        }}
      >
        Öppna Products
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
