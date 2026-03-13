import { Info, SlidersHorizontal, Trash2, User, X } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/core/api/AppContext';
import { BulkEmailDialog } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { matchesApi } from '@/plugins/matches/api/matchesApi';
import { useMatches } from '@/plugins/matches/hooks/useMatches';
import type { Match } from '@/plugins/matches/types/match';

import { slotsApi } from '../api/slotsApi';
import { useSlotsContext } from '../context/SlotsContext';
import type { Slot, SlotBooking, SlotMention } from '../types/slots';
import { formatSlotInfoText, formatSlotInfoHtml } from '../utils/slotContactUtils';

import { CapacityAssignedDots } from './CapacityAssignedDots';

function formatDateTime(s: string | null): string {
  if (!s) {
    return '—';
  }
  return new Date(s).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
}

// ─── Sub-components (extracted from SlotView) ─────────────────────────────────

interface SlotPropertiesCardProps {
  displayMentions: SlotMention[];
  addContactToDraft: (contact: { id: number | string; companyName?: string }) => void;
  removeContactFromDraft: (contactId: string) => void;
  setPropertyDraftField: (field: 'visible' | 'notifications_enabled', value: boolean) => void;
  displaySlot: Slot & Partial<Pick<Slot, 'visible' | 'notifications_enabled'>>;
  assignableContacts: Array<{ id: number | string; companyName?: string }>;
  contacts: Array<{ id: number | string; companyName?: string }>;
  openContactForView: (contact: { id: number | string; companyName?: string }) => void;
}

function SlotPropertiesCard({
  displayMentions,
  addContactToDraft,
  removeContactFromDraft,
  setPropertyDraftField,
  displaySlot,
  assignableContacts,
  contacts,
  openContactForView,
}: SlotPropertiesCardProps) {
  const { t } = useTranslation();
  const addableContacts = assignableContacts.filter(
    (c) => !displayMentions?.some((m) => String(m.contactId) === String(c.id)),
  );
  return (
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
                  const contact = assignableContacts.find((c) => String(c.id) === val);
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
                  {addableContacts.length === 0 ? t('slots.noMoreToAdd') : t('common.addContact')}
                </SelectItem>
                {assignableContacts.map((contact) => (
                  <SelectItem
                    key={contact.id}
                    value={String(contact.id)}
                    className="py-2 focus:bg-accent rounded-md text-[10px]"
                  >
                    {contact.companyName ?? `Contact ${contact.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {displayMentions && displayMentions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {displayMentions.map((m) => {
                const contact = contacts.find((c) => String(c.id) === String(m.contactId));
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
          <div className="border-t border-border/50 pt-3 mt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                {t('common.visible')}
              </div>
              <Switch
                checked={!!displaySlot.visible}
                onCheckedChange={(checked) => setPropertyDraftField('visible', checked)}
                className="h-4 w-7 data-[state=checked]:bg-primary [&>span]:h-3 [&>span]:w-3 [&[data-state=checked]>span]:translate-x-3"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                {t('common.notifications')}
              </div>
              <Switch
                checked={!!displaySlot.notifications_enabled}
                onCheckedChange={(checked) =>
                  setPropertyDraftField('notifications_enabled', checked)
                }
                className="h-4 w-7 data-[state=checked]:bg-primary [&>span]:h-3 [&>span]:w-3 [&[data-state=checked]>span]:translate-x-3"
              />
            </div>
          </div>
        </div>
      </DetailSection>
    </Card>
  );
}

interface SlotMetadataCardProps {
  slot: Slot;
  hasMatch: boolean;
  sourceMatch: Match | null;
  onMatchClick: () => void;
}

function SlotMetadataCard({ slot, hasMatch, sourceMatch, onMatchClick }: SlotMetadataCardProps) {
  const { t } = useTranslation();
  return (
    <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
      <DetailSection title={t('slots.information')} icon={Info} iconPlugin="slots" className="p-4">
        <div className="space-y-4 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">ID</span>
            <span className="font-mono font-medium">{formatDisplayNumber('slots', slot.id)}</span>
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
          {hasMatch && (
            <div className="flex justify-between items-center pt-2 border-t border-border/50">
              <span className="text-muted-foreground">Source Match</span>
              {sourceMatch ? (
                <Button
                  variant="link"
                  size="sm"
                  onClick={onMatchClick}
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
  );
}

interface SlotBookingsCardProps {
  bookings: SlotBooking[];
  bookingsLoading: boolean;
  onRequestDelete: (booking: SlotBooking) => void;
}

function SlotBookingsCard({ bookings, bookingsLoading, onRequestDelete }: SlotBookingsCardProps) {
  const { t } = useTranslation();
  if (bookings.length === 0 && !bookingsLoading) {
    return null;
  }
  return (
    <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
      <div className="p-4">
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
            <div className="grid grid-cols-1 gap-3 mt-3">
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
                      onClick={() => onRequestDelete(booking)}
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
  );
}

interface SlotInfoCardProps {
  slot: Slot;
  displaySlot: Slot & Partial<Pick<Slot, 'visible' | 'notifications_enabled'>>;
  hasMatch: boolean;
  sourceMatch: Match | null;
  onMatchClick: () => void;
}

function SlotInfoCard({
  slot,
  displaySlot,
  hasMatch,
  sourceMatch,
  onMatchClick,
}: SlotInfoCardProps) {
  const { t } = useTranslation();
  return (
    <Card
      padding="none"
      className="overflow-hidden border-none shadow-sm bg-background/50 plugin-slots ring-1 ring-border/40"
    >
      <div className="p-6 space-y-5">
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
        {hasMatch && (
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
                      onClick={onMatchClick}
                      className="h-auto p-0 text-sm font-medium plugin-matches text-plugin hover:underline"
                    >
                      {`${sourceMatch.home_team} – ${sourceMatch.away_team}`}
                    </Button>
                  ) : (
                    <span className="text-muted-foreground italic">{t('slots.deletedMatch')}</span>
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
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/50">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
              {t('common.visible')}
            </div>
            <Badge
              variant={displaySlot.visible ? 'default' : 'secondary'}
              className={
                displaySlot.visible ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''
              }
            >
              {displaySlot.visible ? t('common.yes') : t('common.no')}
            </Badge>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
              {t('common.notifications')}
            </div>
            <Badge
              variant={displaySlot.notifications_enabled ? 'default' : 'secondary'}
              className={
                displaySlot.notifications_enabled
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                  : ''
              }
            >
              {displaySlot.notifications_enabled ? t('common.on') : t('common.off')}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── SlotView ────────────────────────────────────────────────────────────────

interface SlotViewProps {
  slot?: Slot;
  item?: Slot;
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
    propertyDraft,
    setPropertyDraftField,
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

  const displaySlot = useMemo(
    () => (slot ? { ...slot, ...propertyDraft } : null),
    [slot, propertyDraft],
  );
  const hasMatch =
    slot?.match_id !== null && slot?.match_id !== undefined && slot?.match_id !== '' && matchLoaded;

  if (!slot) {
    return null;
  }

  return (
    <div className="plugin-slots">
      <DetailLayout
        sidebar={
          <div className="space-y-6">
            <SlotPropertiesCard
              displayMentions={displayMentions}
              addContactToDraft={addContactToDraft}
              removeContactFromDraft={removeContactFromDraft}
              setPropertyDraftField={setPropertyDraftField}
              displaySlot={displaySlot!}
              assignableContacts={assignableContacts}
              contacts={contacts}
              openContactForView={openContactForView}
            />
            <SlotMetadataCard
              slot={slot}
              hasMatch={hasMatch}
              sourceMatch={sourceMatch}
              onMatchClick={handleMatchClick}
            />
            <SlotBookingsCard
              bookings={bookings}
              bookingsLoading={bookingsLoading}
              onRequestDelete={setBookingToDelete}
            />
          </div>
        }
        rightSidebar={
          <DetailActivityLog
            entityType="slot"
            entityId={slot.id}
            limit={30}
            title={t('slots.activity', 'Activity')}
            showClearButton
            refreshKey={slot.updated_at ?? slot.id}
          />
        }
      >
        <div className="space-y-4">
          <SlotInfoCard
            slot={slot}
            displaySlot={displaySlot!}
            hasMatch={hasMatch}
            sourceMatch={sourceMatch}
            onMatchClick={handleMatchClick}
          />
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
