import { MessageSquare, Star, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiFetch } from '@/core/api/apiFetch';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

interface Rating {
  id: string;
  cup_id: string;
  reviewer_name: string;
  reviewer_role: string | null;
  reviewer_club: string | null;
  reviewer_class: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface RatingsData {
  ratings: Rating[];
  count: number;
  avg: number;
}

function StarDisplay({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'h-3.5 w-3.5',
            n <= value
              ? 'fill-amber-400 text-amber-400'
              : 'fill-transparent text-slate-300 dark:text-slate-600',
          )}
        />
      ))}
    </span>
  );
}

export function CupRatings({ cupId }: { cupId: string }) {
  const [data, setData] = useState<RatingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/cups/${cupId}/ratings`);
      if (!res.ok) {
        throw new Error('Failed to load ratings');
      }
      const json = await res.json();
      setData(json as RatingsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ratings');
    } finally {
      setLoading(false);
    }
  }, [cupId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (ratingId: string) => {
    setDeleting(ratingId);
    try {
      const res = await apiFetch(`/api/cups/${cupId}/ratings/${ratingId}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Delete failed');
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              ratings: prev.ratings.filter((r) => r.id !== ratingId),
              count: prev.count - 1,
              avg:
                prev.count <= 1
                  ? 0
                  : parseFloat(
                      (
                        (prev.ratings.reduce((s, r) => s + r.rating, 0) -
                          (prev.ratings.find((r) => r.id === ratingId)?.rating ?? 0)) /
                        (prev.count - 1)
                      ).toFixed(1),
                    ),
            }
          : prev,
      );
    } catch {
      // reload to stay in sync
      await load();
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  };

  const pending = confirmId ? data?.ratings.find((r) => r.id === confirmId) : null;

  return (
    <>
      <Card padding="none" className={cn('mt-3', DETAIL_VIEW_CARD_CLASS)}>
        <DetailSection
          title={`Ratings${data ? ` (${data.count})` : ''}`}
          icon={MessageSquare}
          subtleTitle
          className="p-6"
        >
          {loading && <p className="text-sm text-muted-foreground">Loading ratings…</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!loading && !error && data && data.count === 0 && (
            <p className="text-sm text-muted-foreground">No ratings yet.</p>
          )}
          {!loading && !error && data && data.count > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <StarDisplay value={Math.round(data.avg)} />
                <span className="font-semibold">{data.avg.toFixed(1)}</span>
                <span className="text-muted-foreground">
                  / 5 — {data.count} rating{data.count !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y divide-border rounded-md border border-border">
                {data.ratings.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-3 px-3 py-3">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">
                          {r.reviewer_name}
                        </span>
                        {r.reviewer_club && (
                          <span className="text-xs text-muted-foreground">{r.reviewer_club}</span>
                        )}
                        {r.reviewer_class && (
                          <span className="text-xs text-muted-foreground">
                            · {r.reviewer_class}
                          </span>
                        )}
                        {r.reviewer_role && (
                          <span className="text-xs text-muted-foreground">· {r.reviewer_role}</span>
                        )}
                      </div>
                      <StarDisplay value={r.rating} />
                      {r.comment && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                          {r.comment}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground/60">
                        {new Date(r.created_at).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="h-7 w-7 shrink-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 [&>svg]:text-red-500"
                      disabled={deleting === r.id}
                      onClick={() => setConfirmId(r.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </DetailSection>
      </Card>

      <ConfirmDialog
        isOpen={confirmId !== null}
        title="Delete rating?"
        message={
          pending
            ? `Delete the rating from "${pending.reviewer_name}"? This cannot be undone.`
            : 'Delete this rating?'
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => confirmId && handleDelete(confirmId)}
        onCancel={() => setConfirmId(null)}
        variant="danger"
      />
    </>
  );
}
