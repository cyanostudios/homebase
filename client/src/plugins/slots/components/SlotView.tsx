import {
  AlertCircle,
  CalendarDays,
  Search,
  SlidersHorizontal,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/core/api/AppContext';
import { BulkEmailDialog } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_PROP_ROW_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { formatDateOnly, formatDateTime, formatTime } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { matchesApi } from '@/plugins/matches/api/matchesApi';
import { useMatches } from '@/plugins/matches/hooks/useMatches';
import type { Match } from '@/plugins/matches/types/match';

import { slotsApi } from '../api/slotsApi';
import { useSlotsContext } from '../context/SlotsContext';
import type { Slot, SlotBooking, SlotMention } from '../types/slots';
import {
  appendPublicBookingsToEmailRecipients,
  appendPublicBookingsToMessageRecipients,
  formatSlotInfoHtml,
  formatSlotInfoText,
} from '../utils/slotContactUtils';
import { isSlotTimePast } from '../utils/slotTimeUtils';

import { CapacityAssignedDots } from './CapacityAssignedDots';

function formatTimeOnly(s: string | null): string {
  if (!s) {
    return '—';
  }
  return formatTime(s);
}

// ─── Sub-components (extracted from SlotView) ─────────────────────────────────

interface SlotMainInfoCardProps {
  slot: Slot;
  hasMatch: boolean;
  sourceMatch: Match | null;
  onMatchClick: () => void;
}

function SlotMainInfoCard({ slot, hasMatch, sourceMatch, onMatchClick }: SlotMainInfoCardProps) {
  const slotDatePassed = isSlotTimePast(slot.slot_time);
  const { t } = useTranslation();

  const displayName = slot.name?.trim() || `SLT ${formatDisplayNumber('slots', slot.id)}`;

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-slots')}>
      <div className="p-6 space-y-5">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-normal text-muted-foreground mb-0.5">
            {t('slots.nameLabel')}
          </div>
          <div className={PLUGIN_PAGE_TITLE_CLASS}>{displayName}</div>
        </div>
        {slotDatePassed ? (
          <div
            className="flex w-full max-w-full items-start gap-3 text-sm font-bold leading-snug text-red-600 dark:text-red-400"
            role="alert"
          >
            <span
              className="inline-flex h-[1lh] w-5 shrink-0 items-center justify-center self-start text-red-600 dark:text-red-400"
              aria-hidden
            >
              <AlertCircle className="size-4 shrink-0" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1 text-pretty">{t('slots.slotDatePassed')}</span>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
              {t('slots.startDateLabel')}
            </div>
            <div className="text-sm font-medium">{formatDateOnly(slot.slot_time)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
              {t('slots.endDateLabel')}
            </div>
            <div className="text-sm font-medium">{formatDateOnly(slot.slot_end ?? null)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
              {t('slots.startTimeLabel')}
            </div>
            <div className="text-sm font-medium">{formatTimeOnly(slot.slot_time)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
              {t('slots.endTimeLabel')}
            </div>
            <div className="text-sm font-medium">{formatTimeOnly(slot.slot_end ?? null)}</div>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
            {t('slots.locationLabel')}
          </div>
          <div className="text-base font-medium">{slot.location ?? '—'}</div>
        </div>
        {slot.address !== null && slot.address !== undefined && slot.address.trim() !== '' && (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
              {t('slots.addressLabel')}
            </div>
            <div className="text-sm font-medium">{slot.address.trim()}</div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
              {t('slots.categoryLabel')}
            </div>
            <div className="text-sm font-medium">
              {slot.category?.trim() || t('slots.categoryNone')}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
              {t('slots.capacityLabel')}
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
        {hasMatch && (
          <div className="pt-5 border-t border-border/50">
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
        {slot.description?.trim() && (
          <div className="pt-5 border-t border-border/50 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {t('slots.descriptionLabel')}
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{slot.description.trim()}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

interface SlotSettingsCardProps {
  slot: Slot;
  displaySlot: Slot & Partial<Pick<Slot, 'visible' | 'notifications_enabled'>>;
  displayMentions: SlotMention[];
  addContactToDraft: (contact: { id: number | string; companyName?: string }) => void;
  removeContactFromDraft: (contactId: string) => void;
  setPropertyDraftField: (field: 'visible' | 'notifications_enabled', value: boolean) => void;
  assignableContacts: Array<{ id: number | string; companyName?: string }>;
  contacts: Array<{ id: number | string; companyName?: string }>;
  bookings: SlotBooking[];
  bookingsLoading: boolean;
  onRequestDeleteBooking: (booking: SlotBooking) => void;
}

function SlotSettingsCard({
  slot,
  displaySlot,
  displayMentions,
  addContactToDraft,
  removeContactFromDraft,
  setPropertyDraftField,
  assignableContacts,
  contacts,
  bookings,
  bookingsLoading,
  onRequestDeleteBooking,
}: SlotSettingsCardProps) {
  const slotDatePassed = isSlotTimePast(slot.slot_time);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactSuggestions, setShowContactSuggestions] = useState(false);
  const addableContacts = assignableContacts.filter(
    (c) => !displayMentions?.some((m) => String(m.contactId) === String(c.id)),
  );
  const filteredContactSuggestions = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) {
      return addableContacts;
    }

    return addableContacts.filter((contact) => {
      const c = contact as {
        companyName?: string;
        name?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        phone2?: string;
      };
      const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ');
      return [c.companyName, c.name, fullName, c.email, c.phone, c.phone2]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [addableContacts, contactSearch]);
  const { t } = useTranslation();

  return (
    <div className="space-y-4 plugin-slots">
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'overflow-visible relative z-30')}>
        <DetailSection
          title={t('slots.properties')}
          icon={SlidersHorizontal}
          subtleTitle
          className="p-6"
        >
          <div>
            <div
              className={cn(
                DETAIL_PROP_ROW_CLASS,
                'items-start gap-4',
                slotDatePassed && 'opacity-55 text-muted-foreground',
              )}
              title={slotDatePassed ? t('slots.visibleDisabledPast') : undefined}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {t('slots.visibleLabel')}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{t('slots.visibleHelp')}</p>
              </div>
              <div className="shrink-0 pt-0.5">
                <Switch
                  checked={!!displaySlot.visible}
                  onCheckedChange={(checked) => setPropertyDraftField('visible', checked)}
                  disabled={slotDatePassed}
                  className="h-4 w-7 data-[state=checked]:bg-primary [&>span]:h-3 [&>span]:w-3 [&[data-state=checked]>span]:translate-x-3"
                />
              </div>
            </div>
            <div className={cn(DETAIL_PROP_ROW_CLASS, 'items-start gap-4')}>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {t('slots.notificationsLabel')}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t('slots.notificationsHelp')}
                </p>
              </div>
              <div className="shrink-0 pt-0.5">
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

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <div className="p-6 space-y-2">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
              </span>
              <span className="truncate text-sm font-semibold text-foreground">
                {t('common.contacts')}
              </span>
            </div>
            <Popover
              open={showContactSuggestions && addableContacts.length > 0}
              onOpenChange={setShowContactSuggestions}
            >
              <PopoverAnchor asChild>
                <div className="relative w-full min-w-0 sm:max-w-[260px] sm:shrink-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={contactSearch}
                    onChange={(event) => {
                      setContactSearch(event.target.value);
                      setShowContactSuggestions(true);
                    }}
                    onFocus={() => setShowContactSuggestions(true)}
                    placeholder={
                      addableContacts.length === 0 ? t('slots.noMoreToAdd') : t('common.addContact')
                    }
                    className="h-9 bg-background pl-9 text-xs"
                    disabled={addableContacts.length === 0}
                  />
                </div>
              </PopoverAnchor>
              <PopoverContent
                align="end"
                side="bottom"
                sideOffset={6}
                className="z-[120] w-[var(--radix-popover-trigger-width)] max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
              >
                {filteredContactSuggestions.length > 0 ? (
                  filteredContactSuggestions.map((contact) => {
                    const contactName = contact.companyName ?? `Contact ${contact.id}`;
                    const contactMeta = [
                      (contact as { email?: string }).email,
                      (contact as { phone?: string }).phone,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        className="flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-accent"
                        onClick={() => {
                          addContactToDraft(contact);
                          setContactSearch('');
                          setShowContactSuggestions(false);
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium">{contactName}</span>
                          {contactMeta && (
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {contactMeta}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-2.5 py-2 text-[11px] text-muted-foreground">
                    {contactSearch.trim() ? t('common.noResults') : t('common.addContact')}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
          {displayMentions && displayMentions.length > 0 && (
            <div className="space-y-2 pt-0.5">
              {displayMentions.map((m) => {
                const contact = contacts.find((c) => String(c.id) === String(m.contactId)) as
                  | {
                      id: number | string;
                      companyName?: string;
                      email?: string;
                      phone?: string;
                      phone2?: string;
                    }
                  | undefined;
                const name = contact?.companyName ?? m.contactName ?? m.contactId;
                const meta = [contact?.email, contact?.phone, contact?.phone2].filter(Boolean);

                return (
                  <div key={m.contactId} className="rounded-lg border border-border p-4">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm font-medium">{name}</span>
                        </div>
                        {meta.length > 0 && (
                          <div className="min-w-0 truncate text-xs text-muted-foreground">
                            {meta.join(' · ')}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          className="h-9 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                          onClick={() => removeContactFromDraft(m.contactId)}
                          aria-label={`${t('common.removeContact')} ${name}`}
                        >
                          {t('common.delete')}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {(bookings.length > 0 || bookingsLoading) && (
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
              </span>
              <span className="truncate text-sm font-semibold text-foreground">
                {t('slots.publicBookings')}
              </span>
            </div>
            {bookingsLoading ? (
              <div className="text-sm text-muted-foreground py-1">{t('common.loading')}</div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {bookings.map((booking) => {
                  const metaParts = [
                    booking.email || null,
                    booking.phone || null,
                    formatDateTime(booking.created_at),
                    booking.message ? `"${booking.message}"` : null,
                  ].filter(Boolean);
                  return (
                    <div
                      key={booking.id}
                      className="rounded-lg border border-border p-4 text-card-foreground"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <div className="min-w-0 space-y-0.5">
                          <span className="block truncate text-sm font-medium">{booking.name}</span>
                          {metaParts.length > 0 && (
                            <div className="min-w-0 truncate text-xs text-muted-foreground">
                              {metaParts.join(' · ')}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            className="h-9 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                            onClick={() => onRequestDeleteBooking(booking)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
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
  const { contacts } = useContacts();
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

  const mergedMessageRecipients = useMemo(
    () => appendPublicBookingsToMessageRecipients(sendMessageRecipients, bookings),
    [sendMessageRecipients, bookings],
  );
  const mergedEmailRecipients = useMemo(
    () => appendPublicBookingsToEmailRecipients(sendEmailRecipients, bookings),
    [sendEmailRecipients, bookings],
  );

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
    } catch {
      /* keep dialog dismiss; user can retry */
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
    <>
      <DetailLayout>
        <div className="space-y-4">
          <SlotMainInfoCard
            slot={slot}
            hasMatch={hasMatch}
            sourceMatch={sourceMatch}
            onMatchClick={handleMatchClick}
          />
          <SlotSettingsCard
            slot={slot}
            displaySlot={displaySlot!}
            displayMentions={displayMentions}
            addContactToDraft={addContactToDraft}
            removeContactFromDraft={removeContactFromDraft}
            setPropertyDraftField={setPropertyDraftField}
            assignableContacts={assignableContacts}
            contacts={contacts}
            bookings={bookings}
            bookingsLoading={bookingsLoading}
            onRequestDeleteBooking={setBookingToDelete}
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
        recipients={mergedMessageRecipients}
        pluginSource="slots"
        showRecipientSelection
      />

      <BulkEmailDialog
        isOpen={showSendEmailDialog}
        onClose={closeSendEmailDialog}
        recipients={mergedEmailRecipients}
        pluginSource="slots"
        showRecipientSelection
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
                  {formatDateTime(sendEmailSlot.slot_time)}
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
        title={t('slots.deleteBooking')}
        message={t('slots.deleteBookingConfirm', {
          name: bookingToDelete?.name ?? '—',
        })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={handleDeleteBooking}
        onCancel={() => setBookingToDelete(null)}
        variant="danger"
      />
    </>
  );
}
