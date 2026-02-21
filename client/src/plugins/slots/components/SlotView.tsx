import { Info, SlidersHorizontal, Trash2, User, X } from 'lucide-react';
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
import { BulkEmailDialog } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { matchesApi } from '@/plugins/matches/api/matchesApi';
import { useMatches } from '@/plugins/matches/hooks/useMatches';
import type { Match } from '@/plugins/matches/types/match';

import { slotsApi } from '../api/slotsApi';
import { useSlotsContext } from '../context/SlotsContext';
import type { Slot, SlotBooking } from '../types/slots';
import { formatSlotInfoText, formatSlotInfoHtml } from '../utils/slotContactUtils';

import { CapacityAssignedDots } from './CapacityAssignedDots';

interface SlotViewProps {
  slot?: Slot;
  item?: Slot;
}

function formatDateTime(s: string | null): string {
  if (!s) {
    return '—';
  }
  return new Date(s).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
}

export function SlotView({ slot: slotProp, item }: SlotViewProps) {
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
    showSendMessageDialog,
    sendMessageRecipients,
    closeSendMessageDialog,
    showSendEmailDialog,
    sendEmailRecipients,
    sendEmailSlot,
    closeSendEmailDialog,
  } = useSlotsContext();

  const [sourceMatch, setSourceMatch] = useState<Match | null>(null);
  const [matchLoaded, setMatchLoaded] = useState(false);
  const [bookings, setBookings] = useState<SlotBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<SlotBooking | null>(null);

  useEffect(() => {
    const loadBookings = async () => {
      if (!slot?.id) {
        setBookings([]);
        return;
      }
      setBookingsLoading(true);
      try {
        const data = await slotsApi.getBookings(slot.id);
        setBookings(data);
      } catch {
        setBookings([]);
      }
      setBookingsLoading(false);
    };
    loadBookings();
  }, [slot?.id]);

  const handleDeleteBooking = async () => {
    if (!bookingToDelete) {
      return;
    }
    try {
      await slotsApi.deleteBooking(bookingToDelete.id);
      setBookings((prev) => prev.filter((b) => b.id !== bookingToDelete.id));
    } catch (error) {
      console.error('Failed to delete booking:', error);
    }
    setBookingToDelete(null);
  };

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
    if (sourceMatch) {
      openMatchForView(sourceMatch);
    }
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
                      {slot.created_at ? new Date(slot.created_at).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Updated</span>
                    <span className="font-medium">
                      {slot.updated_at ? new Date(slot.updated_at).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  {slot.match_id !== null &&
                    slot.match_id !== undefined &&
                    slot.match_id !== '' &&
                    matchLoaded && (
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
        <div className="space-y-4">
          {/* Main Info Card */}
          <Card
            padding="none"
            className="overflow-hidden border-none shadow-sm bg-background/50 plugin-slots ring-1 ring-border/40"
          >
            <div className="p-6 space-y-5">
              {/* Header: Slot Number + Location */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                    {t('slots.slotNbr')}
                  </div>
                  <div className="text-2xl font-semibold text-foreground tabular-nums">
                    {formatDisplayNumber('slots', slot.id)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                    {t('common.location')}
                  </div>
                  <div className="text-base font-medium">{slot.location || '—'}</div>
                </div>
              </div>

              {/* Match info (if from match) */}
              {slot.match_id !== null &&
                slot.match_id !== undefined &&
                slot.match_id !== '' &&
                matchLoaded && (
                  <div className="pt-3 border-t border-border/50">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                          {t('slots.match')}
                        </div>
                        <div className="text-sm">
                          {sourceMatch ? (
                            <Button
                              variant="link"
                              size="sm"
                              onClick={handleMatchClick}
                              className="h-auto p-0 text-sm font-medium plugin-matches text-plugin hover:underline"
                            >
                              {`${sourceMatch.home_team} – ${sourceMatch.away_team}`}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground italic">
                              {t('slots.deletedMatch')}
                            </span>
                          )}
                        </div>
                      </div>
                      {sourceMatch && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                            {t('slots.matchNumber')}
                          </div>
                          <div className="text-sm font-medium tabular-nums">
                            {formatDisplayNumber('matches', sourceMatch.id)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {/* Time + Capacity row */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/50">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                    {t('common.time')}
                  </div>
                  <div className="text-sm font-medium">{formatDateTime(slot.slot_time)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                    {t('common.capacity')}
                  </div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    <span className="tabular-nums">{slot.capacity}</span>
                    <CapacityAssignedDots
                      capacity={slot.capacity}
                      assignedCount={(slot.mentions?.length ?? 0) + (slot.booked_count ?? 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Visible + Notifications row */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/50">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                    {t('common.visible')}
                  </div>
                  <Badge
                    variant={slot.visible ? 'default' : 'secondary'}
                    className={
                      slot.visible ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''
                    }
                  >
                    {slot.visible ? t('common.yes') : t('common.no')}
                  </Badge>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                    {t('common.notifications')}
                  </div>
                  <Badge
                    variant={slot.notifications_enabled ? 'default' : 'secondary'}
                    className={
                      slot.notifications_enabled
                        ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                        : ''
                    }
                  >
                    {slot.notifications_enabled ? t('common.on') : t('common.off')}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Public Bookings Section */}
          {(bookings.length > 0 || bookingsLoading) && (
            <Card
              padding="none"
              className="overflow-hidden border-none shadow-sm bg-background/50 ring-1 ring-border/40"
            >
              <div className="p-6">
                <DetailSection
                  title={t('slots.publicBookings', 'Public Bookings')}
                  iconPlugin="slots"
                  defaultOpen={true}
                  className="mb-0"
                >
                  {bookingsLoading ? (
                    <div className="text-sm text-muted-foreground py-2">
                      {t('common.loading', 'Loading...')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      {bookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="p-3 rounded-lg border bg-card text-card-foreground"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-sm">{booking.name}</div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-muted-foreground hover:text-destructive -mt-0.5 -mr-1"
                              onClick={() => setBookingToDelete(booking)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
                            {booking.email && <div>{booking.email}</div>}
                            {booking.phone && <div>{booking.phone}</div>}
                            <div className="text-[10px] pt-1 opacity-70">
                              {formatDateTime(booking.created_at)}
                            </div>
                          </div>
                          {booking.message && (
                            <div className="mt-2 text-xs text-foreground/80 italic border-t border-border/50 pt-2">
                              "{booking.message}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </DetailSection>
              </div>
            </Card>
          )}
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

      <BulkMessageDialog
        isOpen={showSendMessageDialog}
        onClose={closeSendMessageDialog}
        recipients={sendMessageRecipients}
        pluginSource="slots"
      />

      <BulkEmailDialog
        isOpen={showSendEmailDialog}
        onClose={closeSendEmailDialog}
        recipients={sendEmailRecipients}
        pluginSource="slots"
        additionalText={sendEmailSlot ? formatSlotInfoText(sendEmailSlot) : undefined}
        additionalHtml={sendEmailSlot ? formatSlotInfoHtml(sendEmailSlot) : undefined}
        additionalPreview={
          sendEmailSlot ? (
            <div className="text-xs text-muted-foreground space-y-1">
              {sendEmailSlot.location && (
                <div>
                  <span className="font-medium">{t('common.location')}:</span>{' '}
                  {sendEmailSlot.location}
                </div>
              )}
              {sendEmailSlot.slot_time && (
                <div>
                  <span className="font-medium">{t('common.time')}:</span>{' '}
                  {new Date(sendEmailSlot.slot_time).toLocaleString('sv-SE', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}
                </div>
              )}
              <div>
                <span className="font-medium">{t('common.capacity')}:</span>{' '}
                {sendEmailSlot.capacity}
              </div>
            </div>
          ) : undefined
        }
      />

      <ConfirmDialog
        isOpen={!!bookingToDelete}
        title={t('slots.deleteBooking', 'Delete Booking')}
        message={t(
          'slots.deleteBookingConfirm',
          `Are you sure you want to delete the booking from "${bookingToDelete?.name}"?`,
        )}
        confirmText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        onConfirm={handleDeleteBooking}
        onCancel={() => setBookingToDelete(null)}
        variant="destructive"
      />
    </div>
  );
}
