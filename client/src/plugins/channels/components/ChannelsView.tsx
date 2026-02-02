import React, { useEffect, useState } from 'react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/core/ui/Typography';

import { channelsApi } from '../api/channelsApi';
import type { ChannelErrorLogItem, ChannelInstance } from '../types/channels';

interface ChannelsViewProps {
  item: any; // ChannelSummary
}

export const ChannelsView: React.FC<ChannelsViewProps> = ({ item }) => {
  if (!item) {
    return null;
  }

  const updated = item.lastSyncedAt ? new Date(item.lastSyncedAt) : null;

  const [errors, setErrors] = useState<ChannelErrorLogItem[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [instances, setInstances] = useState<ChannelInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [creatingDefaults, setCreatingDefaults] = useState(false);
  const [savingInstanceId, setSavingInstanceId] = useState<string | null>(null);
  const [draftById, setDraftById] = useState<Record<string, { market: string; label: string }>>({});

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingErrors(true);
      try {
        const resp = await channelsApi.getErrors({ channel: String(item.channel), limit: 20 });
        if (cancelled) return;
        const normalized = (resp.items || []).map((e: any) => ({
          ...e,
          createdAt: e.createdAt ? new Date(e.createdAt) : null,
        }));
        setErrors(normalized);
      } catch (err) {
        if (!cancelled) setErrors([]);
        // keep console output for debugging; avoid noisy UI
        console.error('Failed to load channel errors:', err);
      } finally {
        if (!cancelled) setLoadingErrors(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [item.channel]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingInstances(true);
      try {
        const resp = await channelsApi.getInstances({ channel: String(item.channel) });
        if (cancelled) return;
        const items = Array.isArray(resp.items) ? resp.items : [];
        setInstances(items);
        setDraftById((prev) => {
          const next = { ...prev };
          for (const it of items) {
            next[it.id] = {
              market: String(it.market || ''),
              label: String(it.label || ''),
            };
          }
          return next;
        });
      } catch (err) {
        if (!cancelled) setInstances([]);
        console.error('Failed to load channel instances:', err);
      } finally {
        if (!cancelled) setLoadingInstances(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [item.channel]);

  const ensureDefaults = async () => {
    const ch = String(item.channel).toLowerCase();
    const defaults =
      ch === 'cdon' || ch === 'fyndiq'
        ? [
            { instanceKey: 'se', market: 'se', label: 'Sweden' },
            { instanceKey: 'dk', market: 'dk', label: 'Denmark' },
            { instanceKey: 'fi', market: 'fi', label: 'Finland' },
          ]
        : ch === 'woocommerce'
          ? [{ instanceKey: 'default', market: null, label: 'Default store' }]
          : [];

    if (!defaults.length) {
      console.warn('No defaults for channel:', ch);
      return;
    }

    try {
      setLoadingInstances(true);
      for (const d of defaults) {
        await channelsApi.createInstance({
          channel: ch,
          instanceKey: d.instanceKey,
          market: d.market,
          label: d.label,
        });
      }
      const resp = await channelsApi.getInstances({ channel: ch });
      setInstances(resp.items || []);
      setDraftById((prev) => {
        const next = { ...prev };
        for (const inst of resp.items || []) {
          next[inst.id] = {
            market: String(inst.market || ''),
            label: String(inst.label || ''),
          };
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to create default instances:', err);
      alert('Failed to create default instances. Check console for details.');
    } finally {
      setLoadingInstances(false);
    }
  };

  const saveInstance = async (inst: ChannelInstance) => {
    const draft = draftById[inst.id] || { market: '', label: '' };
    setSavingInstanceId(inst.id);
    try {
      const resp = await channelsApi.updateInstance(inst.id, {
        market: (draft.market || '').trim() || null,
        label: (draft.label || '').trim() || null,
      });
      setInstances((prev) => prev.map((x) => (x.id === inst.id ? resp.row : x)));
    } catch (err) {
      console.error('Failed to update instance:', err);
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
          <Button variant="secondary" onClick={ensureDefaults} disabled={creatingDefaults}>
            {creatingDefaults ? 'Creating…' : 'Create defaults'}
          </Button>
        </div>
        <Text variant="caption" className="text-gray-600 mb-3">
          Instances represent markets/stores (e.g. <strong>cdon.se</strong>, <strong>fyndiq.fi</strong>, <strong>woocommerce.shopA</strong>).
        </Text>

        {loadingInstances ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : instances.length === 0 ? (
          <div className="text-sm text-gray-500">
            No instances yet. Click <strong>Create defaults</strong> or import a template that contains instance columns.
          </div>
        ) : (
          <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 overflow-hidden">
            {instances.map((inst) => {
              const draft = draftById[inst.id] || { market: '', label: '' };
              return (
                <div key={inst.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {String(inst.channel).toLowerCase()}.{inst.instanceKey}
                    </div>
                    <div className="text-xs text-gray-500">Instance key: {inst.instanceKey}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="h-9 rounded-md border px-2 text-sm w-24"
                      placeholder="market"
                      value={draft.market}
                      onChange={(e) =>
                        setDraftById((prev) => ({ ...prev, [inst.id]: { ...draft, market: e.target.value } }))
                      }
                    />
                    <input
                      className="h-9 rounded-md border px-2 text-sm w-44"
                      placeholder="label"
                      value={draft.label}
                      onChange={(e) =>
                        setDraftById((prev) => ({ ...prev, [inst.id]: { ...draft, label: e.target.value } }))
                      }
                    />
                    <Button
                      variant="secondary"
                      disabled={savingInstanceId === inst.id}
                      onClick={() => saveInstance(inst)}
                    >
                      {savingInstanceId === inst.id ? 'Saving…' : 'Save'}
                    </Button>
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
