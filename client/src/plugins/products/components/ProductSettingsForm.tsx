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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const raw = await getSettings('products');
        const s = (raw && typeof raw === 'object' ? raw : {}) as ProductSettings;

        const nextCdon: Record<ProductSettingsCdonMarketKey, MarketDelivery> = {} as Record<ProductSettingsCdonMarketKey, MarketDelivery>;
        for (const m of CDON_MARKETS) {
          const fromCdon = s?.defaultDeliveryCdon?.[m.key];
          nextCdon[m.key] = {
            shippingMin: Number.isFinite(fromCdon?.shippingMin) ? fromCdon.shippingMin : 1,
            shippingMax: Number.isFinite(fromCdon?.shippingMax) ? fromCdon.shippingMax : 3,
          };
        }
        setCdonData(nextCdon);

        const nextFyndiq: Record<ProductSettingsFyndiqMarketKey, MarketDelivery> = {} as Record<ProductSettingsFyndiqMarketKey, MarketDelivery>;
        for (const m of FYNDIQ_MARKETS) {
          const fromFyndiq = s?.defaultDeliveryFyndiq?.[m.key];
          nextFyndiq[m.key] = {
            shippingMin: Number.isFinite(fromFyndiq?.shippingMin) ? fromFyndiq.shippingMin : 1,
            shippingMax: Number.isFinite(fromFyndiq?.shippingMax) ? fromFyndiq.shippingMax : 3,
          };
        }
        setFyndiqData(nextFyndiq);
      } catch {
        setCdonData(Object.fromEntries(CDON_MARKETS.map((m) => [m.key, emptyMarketDelivery()])) as Record<ProductSettingsCdonMarketKey, MarketDelivery>);
        setFyndiqData(Object.fromEntries(FYNDIQ_MARKETS.map((m) => [m.key, emptyMarketDelivery()])) as Record<ProductSettingsFyndiqMarketKey, MarketDelivery>);
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
