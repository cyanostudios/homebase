import { Store } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { channelsApi } from '@/plugins/channels/api/channelsApi';
import type { ChannelInstance } from '@/plugins/channels/types/channels';

import { useCdonProducts } from '../context/CdonProductsContext';

export const CdonExportPanel: React.FC = () => {
  const { settings, openCdonSettingsPanel, openCdonSettingsForEdit } = useCdonProducts();

  const [instances, setInstances] = useState<ChannelInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [creatingDefaults, setCreatingDefaults] = useState(false);

  const isConfigured = useMemo(
    () => !!(settings?.connected && settings?.apiKey && settings?.apiSecret),
    [settings],
  );

  useEffect(() => {
    if (!isConfigured) return;
    let cancelled = false;
    const load = async () => {
      setLoadingInstances(true);
      try {
        const resp = await channelsApi.getInstances({ channel: 'cdon' });
        if (!cancelled) setInstances(resp.items || []);
      } catch (err) {
        if (!cancelled) setInstances([]);
        console.error('Failed to load CDON instances:', err);
      } finally {
        if (!cancelled) setLoadingInstances(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isConfigured]);

  const ensureDefaults = async () => {
    try {
      setCreatingDefaults(true);
      const defaults = [
        { instanceKey: 'se', market: 'se', label: 'Sweden' },
        { instanceKey: 'dk', market: 'dk', label: 'Denmark' },
        { instanceKey: 'fi', market: 'fi', label: 'Finland' },
      ];
      for (const d of defaults) {
        await channelsApi.createInstance({
          channel: 'cdon',
          instanceKey: d.instanceKey,
          market: d.market,
          label: d.label,
        });
      }
      const resp = await channelsApi.getInstances({ channel: 'cdon' });
      setInstances(resp.items || []);
    } catch (err) {
      console.error('Failed to create default instances:', err);
      alert('Failed to create default instances. Check console for details.');
    } finally {
      setCreatingDefaults(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {isConfigured && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (settings) openCdonSettingsForEdit(settings);
            }}
          >
            Settings
          </Button>
        )}
      </div>

      {!isConfigured && (
        <Card padding="lg" className="border-dashed">
          <div className="flex items-start gap-4">
            <div className="mt-1">
              <Store className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">
                Connect CDON
              </h3>
              <p className="text-sm text-muted-foreground">
                Add your CDON API credentials. Publish products from <strong>Products</strong>.
              </p>
              <div className="mt-4">
                <Button variant="default" onClick={() => openCdonSettingsPanel(null)}>
                  Connect
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {isConfigured && (
        <>
          <Card padding="sm" className="shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="text-sm font-medium">Connected</div>
              </div>
              <p className="text-sm text-muted-foreground">
                Publish products from <strong>Products</strong> → Publish.
              </p>
            </div>
          </Card>

          <Card padding="sm" className="shadow-none">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  Market Instances
                </h3>
                <p className="text-sm text-muted-foreground">
                  Configure markets (SE, DK, FI) for per-market pricing and activation.
                </p>
              </div>
              {instances.length === 0 && (
                <Button variant="secondary" size="sm" onClick={ensureDefaults} disabled={creatingDefaults}>
                  {creatingDefaults ? 'Creating…' : 'Create defaults'}
                </Button>
              )}
            </div>

            {loadingInstances ? (
              <div className="text-sm text-muted-foreground">Loading instances…</div>
            ) : instances.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No instances configured. Click <strong>Create defaults</strong> to set up SE, DK, and FI markets.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Instance Key</TableHead>
                    <TableHead>Market</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instances.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell>
                        <div className="font-medium">
                          {inst.label || `cdon.${inst.instanceKey}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {inst.instanceKey}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {inst.market || '—'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

        </>
      )}
    </div>
  );
};
