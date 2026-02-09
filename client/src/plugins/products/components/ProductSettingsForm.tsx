// client/src/plugins/products/components/ProductSettingsForm.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Heading } from '@/core/ui/Typography';
import { useApp } from '@/core/api/AppContext';
import type { ProductSettings, ProductSettingsMarketKey } from '../types/products';

const MARKETS: { key: ProductSettingsMarketKey; label: string }[] = [
  { key: 'se', label: 'Sverige' },
  { key: 'dk', label: 'Danmark' },
  { key: 'fi', label: 'Finland' },
  { key: 'no', label: 'Norge' },
];

type MarketDelivery = { shippingMin?: number; shippingMax?: number };

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
  const [formData, setFormData] = useState<Record<ProductSettingsMarketKey, MarketDelivery>>(
    () => Object.fromEntries(MARKETS.map((m) => [m.key, emptyMarketDelivery()])) as Record<ProductSettingsMarketKey, MarketDelivery>,
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const raw = await getSettings('products');
        const s = (raw && typeof raw === 'object' ? raw : {}) as ProductSettings;
        const dd = s?.defaultDelivery;
        const next: Record<ProductSettingsMarketKey, MarketDelivery> = {} as Record<ProductSettingsMarketKey, MarketDelivery>;
        for (const m of MARKETS) {
          const data = dd?.[m.key];
          next[m.key] = {
            shippingMin: Number.isFinite(data?.shippingMin) ? (data!.shippingMin as number) : 1,
            shippingMax: Number.isFinite(data?.shippingMax) ? (data!.shippingMax as number) : 3,
          };
        }
        setFormData(next);
      } catch {
        setFormData(Object.fromEntries(MARKETS.map((m) => [m.key, emptyMarketDelivery()])) as Record<ProductSettingsMarketKey, MarketDelivery>);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [getSettings]);

  const updateMarket = (market: ProductSettingsMarketKey, field: keyof MarketDelivery, value: number | string) => {
    setFormData((prev) => ({
      ...prev,
      [market]: { ...prev[market], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings('products', {
        defaultDelivery: formData,
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
        <Heading level={3} className="mb-3">Standardleverans per marknad</Heading>
        <p className="text-sm text-gray-600 mb-4">
          Dessa värden används i produktens inställningar om du inte angivit något manuellt per marknad.
        </p>
        <div className="space-y-6">
          {MARKETS.map((m) => {
            const data = formData[m.key];
            return (
              <div key={m.key} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                <h4 className="text-sm font-medium mb-3">{m.label}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`${m.key}-shipping-min`}>Frakt min (dagar)</Label>
                    <Input
                      id={`${m.key}-shipping-min`}
                      type="number"
                      min={0}
                      value={data?.shippingMin ?? 1}
                      onChange={(e) =>
                        updateMarket(m.key, 'shippingMin', parseInt(e.target.value, 10) || 1)
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${m.key}-shipping-max`}>Frakt max (dagar)</Label>
                    <Input
                      id={`${m.key}-shipping-max`}
                      type="number"
                      min={0}
                      value={data?.shippingMax ?? 3}
                      onChange={(e) =>
                        updateMarket(m.key, 'shippingMax', parseInt(e.target.value, 10) || 3)
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
