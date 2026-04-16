import { Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

import { ordersApi } from '../api/ordersApi';

const MAX_LEN = 2000;

interface OrderStaffNoteDialogProps {
  open: boolean;
  /** Vilka order som ska få samma anteckning (en eller flera). */
  orderIds: string[] | null;
  title: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (orderIds: string[], hasStaffNote: boolean) => void;
}

export function OrderStaffNoteDialog({
  open,
  orderIds,
  title,
  onOpenChange,
  onSaved,
}: OrderStaffNoteDialogProps) {
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Snapshot while `open` so the heading does not flip when the parent clears `orderIds` before exit animation ends. */
  const [dialogTitle, setDialogTitle] = useState(title);
  useEffect(() => {
    if (open) {
      setDialogTitle(title);
    }
  }, [open, title]);

  useEffect(() => {
    if (!open || !orderIds?.length) {
      return;
    }
    let cancelled = false;
    setError(null);

    if (orderIds.length > 1) {
      setDraft('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setDraft('');
    void ordersApi
      .getNote(orderIds[0])
      .then((res) => {
        if (cancelled) {
          return;
        }
        setDraft(res.note ?? '');
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Kunde inte ladda anteckning.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, orderIds]);

  const handleSave = async () => {
    if (!orderIds?.length) {
      return;
    }
    if (draft.length > MAX_LEN) {
      setError(`Anteckningen får högst vara ${MAX_LEN} tecken.`);
      return;
    }
    const trimmed = draft.trim();
    setSaving(true);
    setError(null);
    try {
      let hasStaffNote: boolean;
      if (orderIds.length === 1) {
        const res = await ordersApi.updateNote(orderIds[0], trimmed);
        hasStaffNote = res.hasStaffNote === true;
      } else {
        const res = await ordersApi.updateNotesBatch(orderIds, trimmed);
        hasStaffNote = res.hasStaffNote === true;
      }
      onOpenChange(false);
      onSaved(orderIds, hasStaffNote);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara.');
    } finally {
      setSaving(false);
    }
  };

  const multi = (orderIds?.length ?? 0) > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin shrink-0" aria-hidden />
            <span>Laddar…</span>
          </div>
        ) : (
          <>
            {multi ? (
              <p className="text-sm text-muted-foreground">
                Samma text sparas på alla valda order ({orderIds!.length} st) och ersätter eventuell
                befintlig anteckning på varje order.
              </p>
            ) : null}
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Intern anteckning (syns inte för kund)"
              rows={8}
              maxLength={MAX_LEN}
              className="min-h-[160px] resize-y"
              aria-label="Anteckning"
            />
            <div className="flex justify-end text-xs text-muted-foreground">
              {draft.length} / {MAX_LEN}
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={loading || saving}>
            {saving ? 'Sparar…' : 'Spara'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
