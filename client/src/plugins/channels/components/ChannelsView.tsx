import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading, Text } from '@/core/ui/Typography';

import { channelsApi } from '../api/channelsApi';
import type { ChannelErrorLogItem, ChannelInstance } from '../types/channels';

interface ChannelsViewProps {
  item: any; // ChannelSummary
}

export const ChannelsView: React.FC<ChannelsViewProps> = ({ item }) => {
  const [errors, setErrors] = useState<ChannelErrorLogItem[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [instances, setInstances] = useState<ChannelInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [creatingDefaults, setCreatingDefaults] = useState(false);
  const [savingInstanceId, setSavingInstanceId] = useState<string | null>(null);

  const channelStr =
    item?.channel === undefined || item?.channel === null ? '' : String(item.channel);
  const isCdonOrFyndiq =
    channelStr.toLowerCase() === 'cdon' || channelStr.toLowerCase() === 'fyndiq';

  useEffect(() => {
    if (!channelStr) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoadingErrors(true);
      try {
        const resp = await channelsApi.getErrors({ channel: channelStr, limit: 20 });
        if (cancelled) {
          return;
        }
        const normalized = (resp.items || []).map((e: any) => ({
          ...e,
          createdAt: e.createdAt ? new Date(e.createdAt) : null,
        }));
        setErrors(normalized);
      } catch (err) {
        if (!cancelled) {
          setErrors([]);
        }
        // keep console output for debugging; avoid noisy UI
        console.error('Failed to load channel errors:', err);
      } finally {
        if (!cancelled) {
          setLoadingErrors(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [channelStr]);

  useEffect(() => {
    if (!channelStr) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoadingInstances(true);
      try {
        const resp = await channelsApi.getInstances({
          channel: channelStr,
          includeDisabled: isCdonOrFyndiq,
        });
        if (cancelled) {
          return;
        }
        const items = Array.isArray(resp.items) ? resp.items : [];
        setInstances(items);
      } catch (err) {
        if (!cancelled) {
          setInstances([]);
        }
        console.error('Failed to load channel instances:', err);
      } finally {
        if (!cancelled) {
          setLoadingInstances(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [channelStr, isCdonOrFyndiq]);

  if (!item) {
    return null;
  }

  const updated = item.lastSyncedAt ? new Date(item.lastSyncedAt) : null;

  const ensureDefaults = async () => {
    const ch = String(item.channel).toLowerCase();
    const defaults =
      ch === 'cdon' || ch === 'fyndiq'
        ? [
            { instanceKey: 'se', market: 'se', label: 'Sweden' },
            { instanceKey: 'dk', market: 'dk', label: 'Denmark' },
            { instanceKey: 'fi', market: 'fi', label: 'Finland' },
            { instanceKey: 'no', market: 'no', label: 'Norway' },
          ]
        : [];

    if (!defaults.length) {
      console.warn('No defaults for channel:', ch);
      return;
    }

    try {
      setCreatingDefaults(true);
      setLoadingInstances(true);
      const resp = await channelsApi.getInstances({ channel: ch, includeDisabled: true });
      const existing = new Set((resp.items || []).map((i) => i.instanceKey.toLowerCase()));
      for (const d of defaults) {
        if (!existing.has(d.instanceKey.toLowerCase())) {
          await channelsApi.createInstance({
            channel: ch,
            instanceKey: d.instanceKey,
            market: d.market,
            label: d.label,
          });
        }
      }
      const afterResp = await channelsApi.getInstances({ channel: ch, includeDisabled: true });
      setInstances(afterResp.items || []);
    } catch (err) {
      console.error('Failed to create default instances:', err);
      alert('Failed to create default instances. Check console for details.');
    } finally {
      setCreatingDefaults(false);
      setLoadingInstances(false);
    }
  };

  const toggleEnabled = async (inst: ChannelInstance) => {
    const nextEnabled = !(inst.enabled !== false);
    setSavingInstanceId(inst.id);
    try {
      const resp = await channelsApi.updateInstance(inst.id, { enabled: nextEnabled });
      setInstances((prev) => prev.map((x) => (x.id === inst.id ? resp.row : x)));
    } catch (err) {
      console.error('Failed to update instance enabled:', err);
    } finally {
      setSavingInstanceId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-2">
          Summary
        </Heading>
        <div className="text-sm text-gray-900 capitalize">{item.channel}</div>
        <Text variant="caption" className="text-gray-600">
          {item.configured ? 'Configured' : 'Not configured'}
        </Text>
      </Card>

      {/* Metrics */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Metrics
        </Heading>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-500">Mapped</div>
            <div className="text-sm font-medium">{item.mappedCount ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Enabled</div>
            <div className="text-sm font-medium">{item.enabledCount ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last Synced</div>
            <div className="text-sm">{updated ? updated.toLocaleString() : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Configured</div>
            <div className="text-sm">{item.configured ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </Card>

      {/* Sync status breakdown */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Last Sync Status
        </Heading>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatusTile label="Success" value={item.status?.success} />
          <StatusTile label="Queued" value={item.status?.queued} />
          <StatusTile label="Errors" value={item.status?.error} />
          <StatusTile label="No Change" value={item.status?.idle} />
        </div>
      </Card>

      {/* Instances */}
      <Card padding="sm" className="shadow-none px-0">
        <div className="flex items-center justify-between gap-3 mb-3">
          <Heading level={3}>Instances</Heading>
          {(String(item.channel).toLowerCase() === 'cdon' ||
            String(item.channel).toLowerCase() === 'fyndiq') && (
            <Button variant="secondary" onClick={ensureDefaults} disabled={creatingDefaults}>
              {creatingDefaults ? 'Creating…' : 'Create defaults'}
            </Button>
          )}
        </div>
        <Text variant="caption" className="text-gray-600 mb-3">
          Instances represent markets/stores (e.g. <strong>cdon.se</strong>,{' '}
          <strong>fyndiq.fi</strong>). WooCommerce import columns use{' '}
          <strong>woocommerce.&lt;instance id&gt;</strong> (siffror = radens id i listan nedan).
        </Text>
        {isCdonOrFyndiq && instances.length > 0 && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
            Aktivera eller avaktivera marknader nedan. Endast aktiva marknader syns i Produkter och
            Orders.
          </p>
        )}

        {loadingInstances ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : instances.length === 0 ? (
          <div className="text-sm text-gray-500">
            No instances yet. Click <strong>Create defaults</strong> or import a template that
            contains instance columns.
          </div>
        ) : (
          <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 overflow-hidden">
            {isCdonOrFyndiq && (
              <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-600 border-b border-gray-200 flex flex-wrap items-center gap-2">
                <span className="w-28 shrink-0">Aktiverad</span>
                <span className="flex-1 min-w-0">Instance</span>
                <span>Market</span>
                <span>Label</span>
              </div>
            )}
            {instances.map((inst) => {
              const enabled = inst.enabled !== false;
              const showEnabledToggle = isCdonOrFyndiq;
              return (
                <div
                  key={inst.id}
                  className={`p-3 flex flex-col sm:flex-row sm:items-center gap-3 ${!enabled ? 'opacity-70' : ''}`}
                >
                  {showEnabledToggle && (
                    <label className="flex items-center gap-2 cursor-pointer shrink-0 order-first w-28">
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={savingInstanceId === inst.id}
                        onChange={() => toggleEnabled(inst)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm whitespace-nowrap">Aktiverad</span>
                    </label>
                  )}
                  <div className={showEnabledToggle ? 'min-w-0 flex-1' : 'flex-1'}>
                    <div className="text-sm font-medium text-gray-900">
                      {String(inst.channel).toLowerCase()}.{inst.instanceKey}
                    </div>
                    <div className="text-xs text-gray-500">Instance key: {inst.instanceKey}</div>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap text-sm text-gray-700">
                    <span>{inst.market || '—'}</span>
                    <span>{inst.label || '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recent errors */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Recent Errors
        </Heading>
        {loadingErrors ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : errors.length === 0 ? (
          <div className="text-sm text-gray-500">No errors logged for this channel.</div>
        ) : (
          <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 overflow-hidden">
            {errors.map((e) => (
              <div key={e.id} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-gray-900">
                    {e.productId ? `Product ${e.productId}` : 'General'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {e.createdAt ? new Date(e.createdAt as any).toLocaleString() : ''}
                  </div>
                </div>
                <div className="text-sm text-gray-700 mt-1">{e.message || 'Unknown error'}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

function StatusTile({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium">{typeof value === 'number' ? value : 0}</div>
    </div>
  );
}
