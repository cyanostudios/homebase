import { Globe, Info, Trophy, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import { useCups } from '../hooks/useCups';
import type { Cup } from '../types/cups';

export function CupView({ cup, item }: { cup?: Cup | null; item?: Cup | null }) {
  const current = cup ?? item ?? null;
  const { deleteCup } = useCups();
  const [showDelete, setShowDelete] = useState(false);
  if (!current) {
    return null;
  }

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-3">
            <Card
              padding="none"
              className="overflow-hidden border border-border/70 bg-card shadow-sm"
            >
              <DetailSection title="Information" icon={Info} className="p-4">
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono">{formatDisplayNumber('cups', current.id)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source URL</span>
                    <span className="max-w-[170px] truncate">{current.source_url || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ingest source</span>
                    <span>{current.ingest_source_id || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ingest run</span>
                    <span>{current.ingest_run_id || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Updated</span>
                    <span>
                      {current.updated_at
                        ? new Date(current.updated_at).toLocaleDateString('sv-SE')
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>
                      {current.created_at
                        ? new Date(current.created_at).toLocaleDateString('sv-SE')
                        : '—'}
                    </span>
                  </div>
                </div>
              </DetailSection>
            </Card>
            <Card
              padding="none"
              className="overflow-hidden border border-border/70 bg-card shadow-sm"
            >
              <DetailSection title="Quick actions" className="p-4">
                <Button
                  variant="ghost"
                  icon={(p) => (
                    <Trash2 {...p} className={`${p.className} text-red-600 dark:text-red-400`} />
                  )}
                  className="h-9 justify-start rounded-md px-3 text-xs hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => setShowDelete(true)}
                >
                  Delete
                </Button>
              </DetailSection>
            </Card>
            <DetailActivityLog plugin="cups" entityId={current.id} title="Activity" />
          </div>
        }
      >
        <Card padding="none" className="overflow-hidden border border-border/70 bg-card shadow-sm">
          <DetailSection title="Cup information" icon={Trophy} className="p-4">
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <span className="text-muted-foreground">Name</span>
                <span className="col-span-2 font-medium">{current.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <span className="text-muted-foreground">Organizer</span>
                <span className="col-span-2">{current.organizer || '—'}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <span className="text-muted-foreground">Location</span>
                <span className="col-span-2">{current.location || '—'}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <span className="text-muted-foreground">Date range</span>
                <span className="col-span-2">
                  {current.start_date
                    ? new Date(current.start_date).toLocaleDateString('sv-SE')
                    : '—'}{' '}
                  -{' '}
                  {current.end_date ? new Date(current.end_date).toLocaleDateString('sv-SE') : '—'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <span className="text-muted-foreground">Categories</span>
                <span className="col-span-2">{current.categories || '—'}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <span className="text-muted-foreground">Match format</span>
                <span className="col-span-2">{current.match_format || '—'}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <span className="text-muted-foreground">Teams</span>
                <span className="col-span-2">
                  {current.team_count !== null && current.team_count !== undefined
                    ? String(current.team_count)
                    : '—'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <span className="text-muted-foreground">Registration</span>
                <span className="col-span-2">
                  {current.registration_url ? (
                    <a
                      className="text-primary hover:underline inline-flex items-center gap-1"
                      href={current.registration_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Open
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <span className="text-muted-foreground">Description</span>
                <span className="col-span-2 whitespace-pre-wrap">{current.description || '—'}</span>
              </div>
            </div>
          </DetailSection>
        </Card>
      </DetailLayout>
      <ConfirmDialog
        isOpen={showDelete}
        title="Delete cup?"
        message={`Delete "${current.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={async () => {
          await deleteCup(current.id);
          setShowDelete(false);
        }}
        onCancel={() => setShowDelete(false)}
        variant="destructive"
      />
    </>
  );
}
