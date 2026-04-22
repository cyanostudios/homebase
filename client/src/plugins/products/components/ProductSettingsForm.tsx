// client/src/plugins/products/components/ProductSettingsForm.tsx
import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import { Heading } from '@/core/ui/Typography';

import { productsApi } from '../api/productsApi';
import {
  CATALOG_PAGE_SIZE_OPTIONS,
  DEFAULT_CATALOG_PAGE_SIZE,
  normalizeCatalogPageSize,
  type ProductSettings,
  type ProductSettingsCdonMarketKey,
  type ProductSettingsFyndiqMarketKey,
  type MarketDelivery,
  type CategoryLanguage,
  type CatalogPageSize,
} from '../types/products';

const CDON_MARKETS: { key: ProductSettingsCdonMarketKey; label: string }[] = [
  { key: 'SE', label: 'Sverige' },
  { key: 'DK', label: 'Danmark' },
  { key: 'NO', label: 'Norge' },
  { key: 'FI', label: 'Finland' },
];

const FYNDIQ_MARKETS: { key: ProductSettingsFyndiqMarketKey; label: string }[] = [
  { key: 'se', label: 'Sverige' },
  { key: 'dk', label: 'Danmark' },
  { key: 'fi', label: 'Finland' },
  { key: 'no', label: 'Norge' },
];

const CATEGORY_LANGUAGE_OPTIONS: { value: CategoryLanguage; label: string }[] = [
  { value: 'sv-SE', label: 'Svenska' },
  { value: 'da-DK', label: 'Danska' },
  { value: 'fi-FI', label: 'Finska' },
  { value: 'nb-NO', label: 'Norska' },
];

const emptyMarketDelivery = (): MarketDelivery => ({
  shippingMin: 1,
  shippingMax: 3,
});

interface ProductSettingsFormProps {
  onClose?: () => void;
}

export const ProductSettingsForm: React.FC<ProductSettingsFormProps> = ({ onClose }) => {
  const { getSettings, updateSettings } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cdonData, setCdonData] = useState<Record<ProductSettingsCdonMarketKey, MarketDelivery>>(
    () =>
      Object.fromEntries(CDON_MARKETS.map((m) => [m.key, emptyMarketDelivery()])) as Record<
        ProductSettingsCdonMarketKey,
        MarketDelivery
      >,
  );
  const [fyndiqData, setFyndiqData] = useState<
    Record<ProductSettingsFyndiqMarketKey, MarketDelivery>
  >(
    () =>
      Object.fromEntries(FYNDIQ_MARKETS.map((m) => [m.key, emptyMarketDelivery()])) as Record<
        ProductSettingsFyndiqMarketKey,
        MarketDelivery
      >,
  );
  const [categoryLanguage, setCategoryLanguage] = useState<CategoryLanguage>('sv-SE');
  const [catalogPageSize, setCatalogPageSize] =
    useState<CatalogPageSize>(DEFAULT_CATALOG_PAGE_SIZE);
  const [selloApiKey, setSelloApiKey] = useState('');
  const [selloConnected, setSelloConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [raw, sello] = await Promise.all([
          getSettings('products'),
          productsApi.getSelloSettings().catch(() => null),
        ]);
        const s = (raw && typeof raw === 'object' ? raw : {}) as ProductSettings;

        const nextCdon: Record<ProductSettingsCdonMarketKey, MarketDelivery> = {} as Record<
          ProductSettingsCdonMarketKey,
          MarketDelivery
        >;
        for (const m of CDON_MARKETS) {
          const fromCdon = s?.defaultDeliveryCdon?.[m.key];
          const min = fromCdon?.shippingMin;
          const max = fromCdon?.shippingMax;
          nextCdon[m.key] = {
            shippingMin: Number.isFinite(min) ? min : 1,
            shippingMax: Number.isFinite(max) ? max : 3,
          };
        }
        setCdonData(nextCdon);

        const nextFyndiq: Record<ProductSettingsFyndiqMarketKey, MarketDelivery> = {} as Record<
          ProductSettingsFyndiqMarketKey,
          MarketDelivery
        >;
        for (const m of FYNDIQ_MARKETS) {
          const fromFyndiq = s?.defaultDeliveryFyndiq?.[m.key];
          const min = fromFyndiq?.shippingMin;
          const max = fromFyndiq?.shippingMax;
          nextFyndiq[m.key] = {
            shippingMin: Number.isFinite(min) ? min : 1,
            shippingMax: Number.isFinite(max) ? max : 3,
          };
        }
        setFyndiqData(nextFyndiq);

        const lang = s?.categoryLanguage;
        setCategoryLanguage(
          lang === 'sv-SE' || lang === 'da-DK' || lang === 'fi-FI' || lang === 'nb-NO'
            ? lang
            : 'sv-SE',
        );
        setCatalogPageSize(normalizeCatalogPageSize(s?.catalogPageSize));
        setSelloApiKey(String(sello?.apiKey || ''));
        setSelloConnected(!!sello?.connected);
        setErrorMessage(null);
      } catch {
        setCdonData(
          Object.fromEntries(CDON_MARKETS.map((m) => [m.key, emptyMarketDelivery()])) as Record<
            ProductSettingsCdonMarketKey,
            MarketDelivery
          >,
        );
        setFyndiqData(
          Object.fromEntries(FYNDIQ_MARKETS.map((m) => [m.key, emptyMarketDelivery()])) as Record<
            ProductSettingsFyndiqMarketKey,
            MarketDelivery
          >,
        );
        setCategoryLanguage('sv-SE');
        setCatalogPageSize(DEFAULT_CATALOG_PAGE_SIZE);
        setSelloApiKey('');
        setSelloConnected(false);
        setErrorMessage('Kunde inte ladda alla produktinställningar.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [getSettings]);

  const updateCdon = (
    market: ProductSettingsCdonMarketKey,
    field: keyof MarketDelivery,
    value: number,
  ) => {
    setCdonData((prev) => ({ ...prev, [market]: { ...prev[market], [field]: value } }));
  };
  const updateFyndiq = (
    market: ProductSettingsFyndiqMarketKey,
    field: keyof MarketDelivery,
    value: number,
  ) => {
    setFyndiqData((prev) => ({ ...prev, [market]: { ...prev[market], [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const [savedSello] = await Promise.all([
        productsApi.putSelloSettings({ apiKey: selloApiKey.trim() }),
        updateSettings('products', {
          defaultDeliveryCdon: cdonData,
          defaultDeliveryFyndiq: fyndiqData,
          categoryLanguage,
          catalogPageSize,
        }),
      ]);
      setSelloConnected(!!savedSello?.connected);
      onClose?.();
    } catch (err: any) {
      console.error('Failed to save product settings', err);
      setErrorMessage(String(err?.message || 'Kunde inte spara produktinställningar.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
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
          Sello API
        </Heading>
        <p className="text-sm text-gray-600 mb-4">
          Spara API-nyckeln här for Sello-import och integrationsmapping. Detta sparas per användare
          i databasen.
        </p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="sello-api-key">API key</Label>
            <Input
              id="sello-api-key"
              type="password"
              value={selloApiKey}
              onChange={(e) => setSelloApiKey(e.target.value)}
              placeholder="Klistra in Sello API-nyckel"
              maxLength={500}
            />
          </div>
          <div className="text-xs text-gray-600">
            Status: {selloConnected ? 'Connected' : 'Not connected'}
          </div>
        </div>
      </Card>

      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Produktlista
        </Heading>
        <p className="text-sm text-gray-600 mb-4">
          Antal produkter som laddas per sida i katalogen. Fler rader ger större svar från servern
          och kan göra listan långsammare.
        </p>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="catalog-page-size">Produkter per sida</Label>
          <select
            id="catalog-page-size"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-[hsl(var(--input-focus-ring))] focus:ring-offset-1 focus:ring-offset-background"
            value={catalogPageSize}
            onChange={(e) => {
              const v = Number(e.target.value);
              setCatalogPageSize(normalizeCatalogPageSize(v));
            }}
          >
            {CATALOG_PAGE_SIZE_OPTIONS.map((n) => (
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

      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Kategorispråk (CDON/Fyndiq)
        </Heading>
        <p className="text-sm text-gray-600 mb-4">
          Språk för kategorilistorna i produktformuläret. Gäller tills du byter.
        </p>
        <div className="max-w-xs">
          <Label htmlFor="category-language">Språk</Label>
          <select
            id="category-language"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-[hsl(var(--input-focus-ring))] focus:ring-offset-1 focus:ring-offset-background mt-1"
            value={categoryLanguage}
            onChange={(e) => {
              const v = e.target.value as CategoryLanguage;
              if (v === 'sv-SE' || v === 'da-DK' || v === 'fi-FI' || v === 'nb-NO') {
                setCategoryLanguage(v);
              }
            }}
          >
            {CATEGORY_LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          CDON – standardleverans
        </Heading>
        <p className="text-sm text-gray-600 mb-4">
          Standard frakt min/max (dagar) per CDON-marknad när produkten inte har manuellt ifyllda
          värden.
        </p>
        <div className="space-y-6">
          {CDON_MARKETS.map((m) => {
            const data = cdonData[m.key];
            return (
              <div key={m.key} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                <h4 className="text-sm font-medium mb-3">{m.label}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`cdon-${m.key}-shipping-min`}>Frakt min (dagar)</Label>
                    <Input
                      id={`cdon-${m.key}-shipping-min`}
                      type="number"
                      min={0}
                      value={data?.shippingMin ?? 1}
                      onChange={(e) =>
                        updateCdon(m.key, 'shippingMin', parseInt(e.target.value, 10) || 1)
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`cdon-${m.key}-shipping-max`}>Frakt max (dagar)</Label>
                    <Input
                      id={`cdon-${m.key}-shipping-max`}
                      type="number"
                      min={0}
                      value={data?.shippingMax ?? 3}
                      onChange={(e) =>
                        updateCdon(m.key, 'shippingMax', parseInt(e.target.value, 10) || 3)
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Fyndiq – standardleverans
        </Heading>
        <p className="text-sm text-gray-600 mb-4">
          Standard frakt min/max (dagar) per Fyndiq-marknad när produkten inte har manuellt ifyllda
          värden.
        </p>
        <div className="space-y-6">
          {FYNDIQ_MARKETS.map((m) => {
            const data = fyndiqData[m.key];
            return (
              <div key={m.key} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                <h4 className="text-sm font-medium mb-3">{m.label}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`fyndiq-${m.key}-shipping-min`}>Frakt min (dagar)</Label>
                    <Input
                      id={`fyndiq-${m.key}-shipping-min`}
                      type="number"
                      min={0}
                      value={data?.shippingMin ?? 1}
                      onChange={(e) =>
                        updateFyndiq(m.key, 'shippingMin', parseInt(e.target.value, 10) || 1)
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`fyndiq-${m.key}-shipping-max`}>Frakt max (dagar)</Label>
                    <Input
                      id={`fyndiq-${m.key}-shipping-max`}
                      type="number"
                      min={0}
                      value={data?.shippingMax ?? 3}
                      onChange={(e) =>
                        updateFyndiq(m.key, 'shippingMax', parseInt(e.target.value, 10) || 3)
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
        )}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </Button>
      </div>
    </div>
  );
};
