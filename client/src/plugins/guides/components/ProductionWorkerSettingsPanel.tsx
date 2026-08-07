import { Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

import { guidesApi } from '../api/guidesApi';
import type { ProductionWorkerSettings } from '../types/guides';

interface ProductionWorkerSettingsPanelProps {
  className?: string;
}

const FALLBACK_INTERVALS = [5000, 15000, 30000, 60000, 300000] as const;

function intervalLabelKey(ms: number): string {
  switch (ms) {
    case 5000:
      return 'guides.productionWorker.interval5s';
    case 15000:
      return 'guides.productionWorker.interval15s';
    case 30000:
      return 'guides.productionWorker.interval30s';
    case 60000:
      return 'guides.productionWorker.interval1m';
    case 300000:
      return 'guides.productionWorker.interval5m';
    default:
      return 'guides.productionWorker.intervalCustom';
  }
}

export const ProductionWorkerSettingsPanel: React.FC<ProductionWorkerSettingsPanelProps> = ({
  className,
}) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ProductionWorkerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await guidesApi.getProductionSettings();
      setSettings(result);
    } catch {
      setError(t('guides.productionWorker.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: { workerEnabled?: boolean; pollIntervalMs?: number }) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await guidesApi.updateProductionSettings(patch);
      setSettings(updated);
    } catch {
      setError(t('guides.productionWorker.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const intervals = settings?.allowedPollIntervalMs?.length
    ? settings.allowedPollIntervalMs
    : [...FALLBACK_INTERVALS];

  return (
    <DetailSection title={t('guides.productionWorker.title')} className={cn('pt-0', className)}>
      <div className="space-y-3 text-xs">
        <p className="text-muted-foreground">{t('guides.productionWorker.description')}</p>
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('common.loading')}
          </div>
        )}
        {error && (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        )}
        {!loading && settings && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="production-worker-enabled" className="text-sm font-medium">
                  {t('guides.productionWorker.enabledLabel')}
                </Label>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {settings.workerEnabled
                    ? t('guides.productionWorker.enabledHintOn')
                    : t('guides.productionWorker.enabledHintOff')}
                </p>
              </div>
              <Switch
                id="production-worker-enabled"
                checked={settings.workerEnabled}
                disabled={saving}
                onCheckedChange={(checked) => void save({ workerEnabled: checked })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="production-worker-interval" className="text-sm font-medium">
                {t('guides.productionWorker.intervalLabel')}
              </Label>
              <NativeSelect
                id="production-worker-interval"
                className="h-9 text-xs"
                value={String(settings.pollIntervalMs)}
                disabled={saving || !settings.workerEnabled}
                onChange={(event) => void save({ pollIntervalMs: Number(event.target.value) })}
              >
                {intervals.map((ms) => (
                  <option key={ms} value={ms}>
                    {t(intervalLabelKey(ms), { ms })}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        )}
      </div>
    </DetailSection>
  );
};
