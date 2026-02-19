import { Info, SlidersHorizontal, User, X } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useMatches } from '@/plugins/matches/hooks/useMatches';

import { matchesApi } from '@/plugins/matches/api/matchesApi';
import type { Match } from '@/plugins/matches/types/match';
import { useKioskContext } from '../context/KioskContext';
import type { Slot } from '../types/kiosk';

import { CapacityAssignedDots } from './CapacityAssignedDots';

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
  const { t } = useTranslation();
  const slot = slotProp ?? item ?? null;
  const { contacts, openContactForView } = useContacts();
  const { contacts: appContacts } = useApp();
  const { openMatchForView, matches } = useMatches();
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
  } = useKioskContext();

  const [sourceMatch, setSourceMatch] = useState<Match | null>(null);
  const [matchLoaded, setMatchLoaded] = useState(false);

  useEffect(() => {
    const loadSourceMatch = async () => {
      const matchId =
        slot?.match_id !== null && slot?.match_id !== undefined && slot.match_id !== ''
          ? String(slot.match_id)
          : null;
      if (!matchId) {
        setSourceMatch(null);
        setMatchLoaded(true);
        return;
      }
      // Prefer match from list (same as TaskView with notes), then fetch by id
      const fromList = matches.find((m) => String(m.id) === matchId);
      if (fromList) {
        setSourceMatch(fromList);
        setMatchLoaded(true);
        return;
      }
      try {
        const match = await matchesApi.getMatch(matchId);
        setSourceMatch(match);
      } catch {
        setSourceMatch(null);
      }
      setMatchLoaded(true);
    };
    loadSourceMatch();
  }, [slot?.match_id, matches]);

  const handleMatchClick = () => {
    if (sourceMatch) openMatchForView(sourceMatch);
  };

  const addableContacts = assignableContacts.filter(
    (c: { id: number | string }) =>
      !displayMentions?.some((m) => String(m.contactId) === String(c.id)),
  );

  if (!slot) {
    return null;
  }

  return (
    <div className="plugin-slots">
      <DetailLayout
        sidebar={
          <div className="space-y-6">
            <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
              <DetailSection
                title={t('slots.slotProperties')}
                icon={SlidersHorizontal}
                iconPlugin="slots"
                className="p-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                      {t('common.contacts')}
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
                        <SelectValue placeholder={t('common.addContact')} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/50 shadow-xl min-w-[180px]">
                        <SelectItem
                          value="__add_contact__"
                          className="py-2 focus:bg-accent rounded-md text-muted-foreground"
                        >
                          {addableContacts.length === 0
                            ? t('slots.noMoreToAdd')
                            : t('common.addContact')}
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
                            className="flex items-center gap-1 text-[10px] font-medium px-2 h-5 border-transparent plugin-slots"
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
                                {t('common.view')}
                              </Button>
                            )}
                            <button
                              type="button"
                              className="ml-0.5 rounded hover:bg-muted p-0.5 disabled:opacity-50"
                              onClick={() => removeContactFromDraft(m.contactId)}
                              aria-label={`${t('common.removeContact')} ${name}`}
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
              <DetailSection
                title={t('slots.information')}
                icon={Info}
                iconPlugin="slots"
                className="p-4"
              >
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono font-medium">
                      {formatDisplayNumber('slots', slot.id)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium">
                      {slot.created_at
                        ? new Date(slot.created_at).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Updated</span>
                    <span className="font-medium">
                      {slot.updated_at
                        ? new Date(slot.updated_at).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>
                  {slot.match_id !== null && slot.match_id !== undefined && slot.match_id !== '' && matchLoaded && (
                    <div className="flex justify-between items-center pt-2 border-t border-border/50">
                      <span className="text-muted-foreground">Source Match</span>
                      {sourceMatch ? (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={handleMatchClick}
                          className="h-auto p-0 text-[10px] plugin-matches text-plugin truncate max-w-[150px]"
                        >
                          {`${sourceMatch.home_team} – ${sourceMatch.away_team}`}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground italic">Deleted Match</span>
                      )}
                    </div>
                  )}
                </div>
              </DetailSection>
            </Card>
          </div>
        }
      >
        <div className="space-y-0">
          <Card
            padding="none"
            className="overflow-hidden border-none shadow-sm bg-background/50 plugin-slots ring-1 ring-border/40"
          >
            <div className="p-8 space-y-6">
              {/* Slot Nbr – primary heading, larger and prominent */}
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                  {t('slots.slotNbr')}
                </div>
                <div className="text-2xl font-semibold text-foreground tabular-nums">
                  {formatDisplayNumber('slots', slot.id)}
                </div>
              </div>

              {/* Match (if from match) – one row */}
              {slot.match_id !== null && slot.match_id !== undefined && slot.match_id !== '' && matchLoaded && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                    {t('slots.match')}
                  </div>
                  <div className="text-base">
                    {sourceMatch ? (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={handleMatchClick}
                        className="h-auto p-0 text-base font-medium plugin-matches text-plugin hover:underline"
                      >
                        {`${sourceMatch.home_team} – ${sourceMatch.away_team}`}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground italic">{t('slots.deletedMatch')}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Matchnummer (if match) – one row */}
              {sourceMatch && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                    {t('slots.matchNumber')}
                  </div>
                  <div className="text-base font-medium tabular-nums">
                    {formatDisplayNumber('matches', sourceMatch.id)}
                  </div>
                </div>
              )}

              {/* Location – one row */}
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                  {t('common.location')}
                </div>
                <div className="text-base font-medium">
                  {slot.location || '—'}
                </div>
              </div>

              {/* Capacity – one row with dots */}
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                  {t('common.capacity')}
                </div>
                <div className="text-base font-medium flex items-center gap-2">
                  <span className="tabular-nums">{slot.capacity}</span>
                  <CapacityAssignedDots
                    capacity={slot.capacity}
                    assignedCount={slot.mentions?.length ?? 0}
                  />
                </div>
              </div>

              {/* Time – one row */}
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                  {t('common.time')}
                </div>
                <div className="text-base font-medium">
                  {formatDateTime(slot.slot_time)}
                </div>
              </div>

              {/* Visible – one row */}
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                  {t('common.visible')}
                </div>
                <div className="text-base font-medium">
                  {slot.visible ? t('common.yes') : t('common.no')}
                </div>
              </div>

              {/* Notifications – one row */}
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                  {t('common.notifications')}
                </div>
                <div className="text-base font-medium">
                  {slot.notifications_enabled ? t('common.on') : t('common.off')}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </DetailLayout>
      <ConfirmDialog
        isOpen={showDiscardQuickEditDialog}
        title={t('dialog.unsavedChanges')}
        message={t('dialog.discardQuickEditMessage')}
        confirmText={t('common.discardChanges')}
        cancelText={t('common.continueEditing')}
        onConfirm={onDiscardQuickEditAndClose}
        onCancel={() => setShowDiscardQuickEditDialog(false)}
        variant="warning"
      />
    </div>
  );
}
