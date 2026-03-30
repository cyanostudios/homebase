import React, { useEffect, useMemo, useState } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { ingestApi } from '@/plugins/ingest/api/ingestApi';
import type { IngestSource } from '@/plugins/ingest/types/ingest';

interface CupIngestPickSourceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  allowedIngestSourceIds: string[];
  defaultSourceId: string;
  onConfirm: (sourceId: string) => void;
  confirming: boolean;
}

export function CupIngestPickSourceDialog({
  isOpen,
  onOpenChange,
  allowedIngestSourceIds,
  defaultSourceId,
  onConfirm,
  confirming,
}: CupIngestPickSourceDialogProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open && confirming) {
      return;
    }
    onOpenChange(open);
  };
  const [sources, setSources] = useState<IngestSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    ingestApi
      .getSources()
      .then((list) => {
        if (!cancelled) {
          setSources(list || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSources([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const options = useMemo(() => {
    const allowedSet = new Set(allowedIngestSourceIds.map(String));
    if (allowedIngestSourceIds.length > 0) {
      return sources.filter((s) => allowedSet.has(String(s.id)));
    }
    return sources;
  }, [sources, allowedIngestSourceIds]);

  useEffect(() => {
    if (!isOpen || loading) {
      return;
    }
    const preferred =
      defaultSourceId && options.some((s) => String(s.id) === String(defaultSourceId));
    if (preferred) {
      setSelectedId(String(defaultSourceId));
      return;
    }
    if (options.length > 0) {
      setSelectedId(String(options[0].id));
      return;
    }
    setSelectedId('');
  }, [isOpen, loading, defaultSourceId, options]);

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Import from Ingest</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-1 text-left text-foreground">
              <p className="text-sm text-muted-foreground">
                Choose which ingest source to run for Cups import.
              </p>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading sources…</p>
              ) : options.length === 0 ? (
                <p className="text-sm text-destructive">
                  No ingest sources available. Add sources in Ingest or enable them under Cups
                  settings.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="cups-ingest-source" className="text-sm font-medium">
                    Ingest source
                  </Label>
                  <NativeSelect
                    id="cups-ingest-source"
                    className="h-9 text-sm"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    disabled={confirming}
                  >
                    {options.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name || s.sourceUrl || s.id}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel asChild>
            <Button
              type="button"
              variant="secondary"
              className="h-9 px-3 text-xs"
              disabled={confirming}
            >
              Cancel
            </Button>
          </AlertDialogCancel>
          <Button
            type="button"
            variant="primary"
            className="h-9 px-3 text-xs"
            disabled={confirming || !selectedId || options.length === 0}
            onClick={() => onConfirm(selectedId)}
          >
            {confirming ? 'Importing…' : 'Import'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
