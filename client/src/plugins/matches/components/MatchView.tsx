import { Info } from 'lucide-react';
import React from 'react';

import { Card } from '@/components/ui/card';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';

import type { Match } from '../types/match';

interface MatchViewProps {
  match?: Match;
  item?: Match;
}

function formatDateTime(s: string | null): string {
  if (!s) {
    return '—';
  }
  return new Date(s).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
}

export function MatchView({ match: matchProp, item }: MatchViewProps) {
  const match = matchProp ?? item ?? null;
  const { contacts, openContactForView } = useContacts();
  const linkedContacts =
    match?.mentions?.length > 0
      ? (match.mentions
          .map((m) =>
            contacts.find((c: { id: number | string }) => String(c.id) === String(m.contactId)),
          )
          .filter(Boolean) as { id: number | string; companyName?: string }[])
      : [];

  if (!match) {
    return null;
  }

  const sportLabel = match.sport_type === 'football' ? 'Football' : 'Handball';

  return (
    <div className="plugin-matches">
      <DetailLayout
        sidebar={
          <div className="space-y-6">
            <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
              <DetailSection title="Information" icon={Info} iconPlugin="matches" className="p-4">
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Match</span>
                    <span className="font-medium">
                      {match.home_team} – {match.away_team}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-medium truncate max-w-[150px]">
                      {match.location || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Time</span>
                    <span className="font-medium">{formatDateTime(match.start_time)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Sport</span>
                    <span className="font-medium">{sportLabel}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Format</span>
                    <span className="font-medium">{match.format}</span>
                  </div>
                  {match.total_minutes !== null && match.total_minutes !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Minutes</span>
                      <span className="font-medium">{match.total_minutes} min</span>
                    </div>
                  )}
                  {linkedContacts.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground text-[10px]">Contacts</span>
                      {linkedContacts.map((contact) => (
                        <div key={contact.id} className="flex justify-between items-center">
                          <span className="font-medium truncate max-w-[120px] text-xs">
                            {contact.companyName ?? 'Contact'}
                          </span>
                          <button
                            type="button"
                            onClick={() => openContactForView(contact)}
                            className="text-[10px] font-medium text-primary hover:underline shrink-0"
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="pt-2 mt-2 border-t border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-mono text-[10px] opacity-70">
                        {match.created_at
                          ? new Date(match.created_at).toLocaleDateString('sv-SE')
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-muted-foreground">Updated</span>
                      <span className="font-mono text-[10px] opacity-70">
                        {match.updated_at
                          ? new Date(match.updated_at).toLocaleDateString('sv-SE')
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
            <DetailSection title="Match" iconPlugin="matches" className="p-6">
              <div className="text-lg font-semibold">
                {match.home_team} – {match.away_team}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {match.location && <span>{match.location}</span>}
                {match.location && match.start_time && ' · '}
                {match.start_time && <span>{formatDateTime(match.start_time)}</span>}
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground">
                  {sportLabel} · {match.format}
                </span>
                {match.total_minutes !== null && match.total_minutes !== undefined && (
                  <span className="text-xs font-medium text-muted-foreground">
                    · {match.total_minutes} min
                  </span>
                )}
              </div>
            </DetailSection>
          </Card>
        </div>
      </DetailLayout>
    </div>
  );
}
