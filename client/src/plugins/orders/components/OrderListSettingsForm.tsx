import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import {
  DEFAULT_LIST_PAGE_SIZE,
  LIST_PAGE_SIZE_OPTIONS,
  type ListPageSize,
  normalizeListPageSize,
} from '@/core/settings/listPageSizes';
import { Heading } from '@/core/ui/Typography';

import type { OrderSettings } from '../types/orders';

interface OrderListSettingsFormProps {
  onClose?: () => void;
}

export const OrderListSettingsForm: React.FC<OrderListSettingsFormProps> = ({ onClose }) => {
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listPageSize, setListPageSize] = useState<ListPageSize>(DEFAULT_LIST_PAGE_SIZE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const raw = await getSettings('orders');
        const s = (raw && typeof raw === 'object' ? raw : {}) as OrderSettings;
        setListPageSize(normalizeListPageSize(s.listPageSize));
        setErrorMessage(null);
      } catch {
        setListPageSize(DEFAULT_LIST_PAGE_SIZE);
        setErrorMessage('Kunde inte ladda orderinställningar.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [getSettings, settingsVersion]);

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      await updateSettings('orders', { listPageSize });
      onClose?.();
    } catch (err: any) {
      console.error('Failed to save order list settings', err);
      setErrorMessage(String(err?.message || 'Kunde inte spara inställningar.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Laddar…</div>;
  }

  return (
    <div className="space-y-4">
      {errorMessage && (
        <Card padding="sm" className="shadow-none px-0">
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </div>
        </Card>
      )}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Orderlista
        </Heading>
        <p className="text-sm text-gray-600 mb-4">
          Antal order som laddas per sida. Fler rader ger större svar från servern och kan göra
          listan långsammare.
        </p>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="orders-list-page-size">Order per sida</Label>
          <select
            id="orders-list-page-size"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={listPageSize}
            onChange={(e) => setListPageSize(normalizeListPageSize(Number(e.target.value)))}
          >
            {LIST_PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
            Högre värde kan ge längre laddningstider och mer data i webbläsaren per begäran.
          </p>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
        )}
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </Button>
      </div>
    </div>
  );
};
