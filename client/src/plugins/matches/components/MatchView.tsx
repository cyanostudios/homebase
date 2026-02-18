import { Info, SlidersHorizontal, User, X } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';

import { useMatchContext } from '../context/MatchContext';
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
  const { contacts: appContacts } = useApp();
  const assignableContacts = (appContacts ?? contacts).filter(
    (c: { isAssignable?: boolean }) => c.isAssignable !== false,
  );
  const {
    displayMentions,
    addContactToDraft,
    removeContactFromDraft,
    showDiscardQuickEditDialog,
    setShowDiscardQuickEditDialog,
    onDiscardQuickEditAndClose,
  } = useMatchContext();

  const addableContacts = assignableContacts.filter(
    (c: { id: number | string }) =>
      !displayMentions?.some((m) => String(m.contactId) === String(c.id)),
  );

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
              <DetailSection
                title="Match Properties"
                icon={SlidersHorizontal}
                iconPlugin="matches"
                className="p-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                      Contacts
                    </div>
                    <Select
                      value="__add_contact__"
                      onValueChange={(val) => {
                        if (val && val !== '__add_contact__') {
                          const contact = assignableContacts.find(
                            (c: { id: number | string }) => String(c.id) === val,
                          );
                          if (contact) {
                            addContactToDraft(contact);
                          }
                        }
                      }}
                      disabled={addableContacts.length === 0}
                    >
                      <SelectTrigger className="h-7 w-[140px] bg-background border-border/50 hover:bg-accent/50 transition-colors shadow-none rounded-md px-2 text-[10px] font-medium">
                        <SelectValue placeholder="Lägg till kontakt..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/50 shadow-xl min-w-[180px]">
                        <SelectItem
                          value="__add_contact__"
                          className="py-2 focus:bg-accent rounded-md text-muted-foreground"
                        >
                          {addableContacts.length === 0
                            ? 'Inga fler att lägga till'
                            : 'Lägg till kontakt...'}
                        </SelectItem>
                        {addableContacts.map(
                          (contact: { id: number | string; companyName?: string }) => (
                            <SelectItem
                              key={contact.id}
                              value={String(contact.id)}
                              className="py-2 focus:bg-accent rounded-md text-[10px]"
                            >
                              {contact.companyName ?? `Contact ${contact.id}`}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {displayMentions && displayMentions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {displayMentions.map((m) => {
                        const contact = contacts.find(
                          (c: { id: number | string }) => String(c.id) === String(m.contactId),
                        ) as { id: number | string; companyName?: string } | undefined;
                        const name = contact?.companyName ?? m.contactName ?? m.contactId;
                        return (
                          <Badge
                            key={m.contactId}
                            variant="secondary"
                            className="flex items-center gap-1 text-[10px] font-medium px-2 h-5 border-transparent plugin-matches"
                          >
                            <User className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[100px]">{name}</span>
                            {contact && (
                              <Button
                                size="sm"
                                variant="link"
                                onClick={() => openContactForView(contact)}
                                className="h-auto p-0 text-[9px] shrink-0 font-medium text-plugin"
                              >
                                View
                              </Button>
                            )}
                            <button
                              type="button"
                              className="ml-0.5 rounded hover:bg-muted p-0.5 disabled:opacity-50"
                              onClick={() => removeContactFromDraft(m.contactId)}
                              aria-label={`Ta bort ${name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </DetailSection>
            </Card>

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
      <ConfirmDialog
        isOpen={showDiscardQuickEditDialog}
        title="Unsaved changes"
        message="You have unsaved changes to contacts. Do you want to discard them?"
        confirmText="Discard changes"
        cancelText="Continue editing"
        onConfirm={onDiscardQuickEditAndClose}
        onCancel={() => setShowDiscardQuickEditDialog(false)}
        variant="warning"
      />
    </div>
  );
}
