import { RefreshCw, ShoppingCart, Trash2 } from 'lucide-react';
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
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

import { woocommerceApi } from '../api/woocommerceApi';
import { useWooCommerce } from '../context/WooCommerceContext';

interface WooInstance {
  id: string;
  channel: string;
  instanceKey: string;
  market: string | null;
  label: string | null;
  credentials: {
    storeUrl: string;
    consumerKey: string;
    consumerSecret: string;
    useQueryAuth: boolean;
  } | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const WooExportPanel: React.FC = () => {
  const { instances, openWooSettingsPanel, openWooSettingsForEdit, loadWooSettings } =
    useWooCommerce();
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [syncCategoryInstanceId, setSyncCategoryInstanceId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    instanceId: string;
    instanceName: string;
  }>({
    isOpen: false,
    instanceId: '',
    instanceName: '',
  });

  const isConfigured = useMemo(() => instances.length > 0, [instances.length]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingInstances(true);
      try {
        await loadWooSettings();
      } catch (err) {
        console.error('Failed to load WooCommerce instances:', err);
      } finally {
        if (!cancelled) {
          setLoadingInstances(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [loadWooSettings]);

  const handleDelete = (inst: WooInstance) => {
    setDeleteConfirm({
      isOpen: true,
      instanceId: inst.id,
      instanceName: inst.label || inst.instanceKey || 'this store',
    });
  };

  const confirmDelete = async () => {
    try {
      await woocommerceApi.deleteInstance(deleteConfirm.instanceId);
      // Reload instances list
      await loadWooSettings();
      setDeleteConfirm({
        isOpen: false,
        instanceId: '',
        instanceName: '',
      });
    } catch (err) {
      console.error('Failed to delete WooCommerce instance:', err);
      setDeleteConfirm({
        isOpen: false,
        instanceId: '',
        instanceName: '',
      });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm({
      isOpen: false,
      instanceId: '',
      instanceName: '',
    });
  };

  const handleSyncCategories = async (inst: WooInstance) => {
    setSyncCategoryInstanceId(inst.id);
    try {
      await woocommerceApi.syncCategoryCache(inst.id);
      window.dispatchEvent(
        new CustomEvent('category-cache-invalidated', { detail: { key: `woo:${inst.id}` } }),
      );
    } catch (err) {
      console.error('Failed to sync categories:', err);
    } finally {
      setSyncCategoryInstanceId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {isConfigured && (
          <Button variant="outline" size="sm" onClick={() => openWooSettingsPanel(null)}>
            Add Store
          </Button>
        )}
      </div>

      {!isConfigured && (
        <Card padding="lg" className="border-dashed">
          <div className="flex items-start gap-4">
            <div className="mt-1">
              <ShoppingCart className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Connect your WooCommerce store</h3>
              <p className="text-sm text-muted-foreground">
                Add your store URL and API keys. Publish products from <strong>Products</strong>.
              </p>
              <div className="mt-4">
                <Button variant="default" onClick={() => openWooSettingsPanel(null)}>
                  Connect Store
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
                <h3 className="text-lg font-semibold mb-1">Stores</h3>
                <p className="text-sm text-muted-foreground">
                  Manage multiple WooCommerce stores. Each store can have its own products and
                  orders.
                </p>
              </div>
            </div>

            {loadingInstances ? (
              <div className="text-sm text-muted-foreground">Loading stores…</div>
            ) : instances.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No stores configured. Click <strong>Add Store</strong> to connect your first
                WooCommerce store.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Store URL</TableHead>
                    <TableHead>Instance Key</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instances.map((inst) => {
                    const creds = inst.credentials;
                    return (
                      <TableRow key={inst.id}>
                        <TableCell>
                          <div className="font-medium">{inst.label || inst.instanceKey}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {creds?.storeUrl || '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">{inst.instanceKey}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                openWooSettingsForEdit({
                                  id: inst.id,
                                  storeUrl: creds?.storeUrl ?? '',
                                  consumerKey: creds?.consumerKey ?? '',
                                  consumerSecret: creds?.consumerSecret ?? '',
                                  useQueryAuth: creds?.useQueryAuth ?? false,
                                  label: inst.label ?? '',
                                  instanceKey: inst.instanceKey,
                                } as any)
                              }
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSyncCategories(inst)}
                              disabled={syncCategoryInstanceId === inst.id}
                              title="Sync categories"
                            >
                              <RefreshCw
                                className={`w-4 h-4 ${syncCategoryInstanceId === inst.id ? 'animate-spin' : ''}`}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(inst)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Store"
        message={`Are you sure you want to delete "${deleteConfirm.instanceName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </div>
  );
};
