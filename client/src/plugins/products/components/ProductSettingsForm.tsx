// client/src/plugins/products/components/ProductSettingsForm.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Heading } from '@/core/ui/Typography';
import { useApp } from '@/core/api/AppContext';
import type {
  ProductSettings,
  ProductSettingsCdonMarketKey,
  ProductSettingsFyndiqMarketKey,
  MarketDelivery,
  CategoryLanguage,
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
    () => Object.fromEntries(CDON_MARKETS.map((m) => [m.key, emptyMarketDelivery()])) as Record<ProductSettingsCdonMarketKey, MarketDelivery>,
  );
  const [fyndiqData, setFyndiqData] = useState<Record<ProductSettingsFyndiqMarketKey, MarketDelivery>>(
    () => Object.fromEntries(FYNDIQ_MARKETS.map((m) => [m.key, emptyMarketDelivery()])) as Record<ProductSettingsFyndiqMarketKey, MarketDelivery>,
  );
  const [categoryLanguage, setCategoryLanguage] = useState<CategoryLanguage>('sv-SE');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const raw = await getSettings('products');
        const s = (raw && typeof raw === 'object' ? raw : {}) as ProductSettings;

        const nextCdon: Record<ProductSettingsCdonMarketKey, MarketDelivery> = {} as Record<ProductSettingsCdonMarketKey, MarketDelivery>;
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

        const nextFyndiq: Record<ProductSettingsFyndiqMarketKey, MarketDelivery> = {} as Record<ProductSettingsFyndiqMarketKey, MarketDelivery>;
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
          lang === 'sv-SE' || lang === 'da-DK' || lang === 'fi-FI' || lang === 'nb-NO' ? lang : 'sv-SE',
        );
      } catch {
        setCdonData(Object.fromEntries(CDON_MARKETS.map((m) => [m.key, emptyMarketDelivery()])) as Record<ProductSettingsCdonMarketKey, MarketDelivery>);
        setFyndiqData(Object.fromEntries(FYNDIQ_MARKETS.map((m) => [m.key, emptyMarketDelivery()])) as Record<ProductSettingsFyndiqMarketKey, MarketDelivery>);
        setCategoryLanguage('sv-SE');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [getSettings]);

  const updateCdon = (market: ProductSettingsCdonMarketKey, field: keyof MarketDelivery, value: number) => {
    setCdonData((prev) => ({ ...prev, [market]: { ...prev[market], [field]: value } }));
  };
  const updateFyndiq = (market: ProductSettingsFyndiqMarketKey, field: keyof MarketDelivery, value: number) => {
    setFyndiqData((prev) => ({ ...prev, [market]: { ...prev[market], [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings('products', {
        defaultDeliveryCdon: cdonData,
        defaultDeliveryFyndiq: fyndiqData,
        categoryLanguage,
      });
      onClose?.();
    } catch (err) {
      console.error('Failed to save product settings', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">Kategorispråk (CDON/Fyndiq)</Heading>
        <p className="text-sm text-gray-600 mb-4">
          Språk för kategorilistorna i produktformuläret. Gäller tills du byter.
        </p>
        <div className="max-w-xs">
          <Label htmlFor="category-language">Språk</Label>
          <select
            id="category-language"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 mt-1"
            value={categoryLanguage}
            onChange={(e) => {
              const v = e.target.value as CategoryLanguage;
              if (v === 'sv-SE' || v === 'da-DK' || v === 'fi-FI' || v === 'nb-NO') setCategoryLanguage(v);
            }}
          >
            {CATEGORY_LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">CDON – standardleverans</Heading>
        <p className="text-sm text-gray-600 mb-4">
          Standard frakt min/max (dagar) per CDON-marknad när produkten inte har manuellt ifyllda värden.
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
                      onChange={(e) => updateCdon(m.key, 'shippingMin', parseInt(e.target.value, 10) || 1)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`cdon-${m.key}-shipping-max`}>Frakt max (dagar)</Label>
                    <Input
                      id={`cdon-${m.key}-shipping-max`}
                      type="number"
                      min={0}
                      value={data?.shippingMax ?? 3}
                      onChange={(e) => updateCdon(m.key, 'shippingMax', parseInt(e.target.value, 10) || 3)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">Fyndiq – standardleverans</Heading>
        <p className="text-sm text-gray-600 mb-4">
          Standard frakt min/max (dagar) per Fyndiq-marknad när produkten inte har manuellt ifyllda värden.
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
                      onChange={(e) => updateFyndiq(m.key, 'shippingMin', parseInt(e.target.value, 10) || 1)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`fyndiq-${m.key}-shipping-max`}>Frakt max (dagar)</Label>
                    <Input
                      id={`fyndiq-${m.key}-shipping-max`}
                      type="number"
                      min={0}
                      value={data?.shippingMax ?? 3}
                      onChange={(e) => updateFyndiq(m.key, 'shippingMax', parseInt(e.target.value, 10) || 3)}
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
