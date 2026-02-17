import { Info } from 'lucide-react';
import React from 'react';

import { Card } from '@/components/ui/card';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';

import type { Slot } from '../types/kiosk';

interface KioskViewProps {
  slot?: Slot;
  item?: Slot;
}

function formatDateTime(s: string | null): string {
  if (!s) {
    return '—';
  }
  return new Date(s).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
}

export function KioskView({ slot: slotProp, item }: KioskViewProps) {
  const slot = slotProp ?? item ?? null;
  if (!slot) {
    return null;
  }

  return (
    <div className="plugin-kiosk">
      <DetailLayout
        sidebar={
          <div className="space-y-6">
            <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
              <DetailSection title="Information" icon={Info} iconPlugin="kiosk" className="p-4">
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-medium truncate max-w-[150px]">
                      {slot.location || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Time</span>
                    <span className="font-medium">{formatDateTime(slot.slot_time)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Capacity</span>
                    <span className="font-medium">{slot.capacity}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Visible</span>
                    <span className="font-medium">{slot.visible ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Notifications</span>
                    <span className="font-medium">{slot.notifications_enabled ? 'On' : 'Off'}</span>
                  </div>
                  <div className="pt-2 mt-2 border-t border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-mono text-[10px] opacity-70">
                        {slot.created_at
                          ? new Date(slot.created_at).toLocaleDateString('sv-SE')
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-muted-foreground">Updated</span>
                      <span className="font-mono text-[10px] opacity-70">
                        {slot.updated_at
                          ? new Date(slot.updated_at).toLocaleDateString('sv-SE')
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </DetailSection>
            </Card>
          </div>
        }
      >
        <div className="space-y-6">
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title="Slot" iconPlugin="kiosk" className="p-6">
              <div className="text-lg font-semibold">{slot.location || '—'}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {formatDateTime(slot.slot_time)}
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground">
                  Capacity: {slot.capacity}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  · {slot.visible ? 'Visible' : 'Hidden'}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  · Notifications {slot.notifications_enabled ? 'on' : 'off'}
                </span>
              </div>
            </DetailSection>
          </Card>
        </div>
      </DetailLayout>
    </div>
  );
}
