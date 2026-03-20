import { Check, Copy, Edit, Info, Trash2, User, X, Zap } from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

function formatDateTime(s: string | null): string {
  if (!s) {
    return '—';
  }
  return new Date(s).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDateOnly(s: string | null): string {
  if (!s) {
    return '—';
  }
  return new Date(s).toLocaleDateString('sv-SE', { dateStyle: 'short' });
}

function formatTimeOnly(s: string | null): string {
  if (!s) {
    return '—';
  }
  return new Date(s).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

/** White card shell for properties, info, metadata, bookings, activity (detail area has gray bg) */
const SLOT_DETAIL_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm';

// ─── Sub-components (extracted from SlotView) ─────────────────────────────────

interface SlotQuickActionsCardProps {
  slot: Slot;
  onEdit: (slot: Slot) => void;
  onDeleteClick: () => void;
  onDuplicate: (slot: Slot) => void;
  getDuplicateConfig: (
    item: Slot | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly?: boolean } | null;
  detailFooterActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Slot) => void;
    className?: string;
    disabled?: boolean;
  }>;
  hasQuickEditChanges: boolean;
  onApplyQuickEdit: () => Promise<void>;
}

function SlotQuickActionsCard({
  slot,
  onEdit,
  onDeleteClick,
  onDuplicate,
  getDuplicateConfig,
  detailFooterActions,
  hasQuickEditChanges,
  onApplyQuickEdit,
}: SlotQuickActionsCardProps) {
  const { t } = useTranslation();
  const canDuplicate = Boolean(getDuplicateConfig(slot));
  return (
    <Card padding="none" className={SLOT_DETAIL_CARD_CLASS}>
      <DetailSection title={t('slots.quickActions')} icon={Zap} iconPlugin="slots" className="p-4">
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={Edit}
            className="h-9 w-full justify-start rounded-md bg-muted/60 px-3 text-xs hover:bg-muted"
            onClick={() => onEdit(slot)}
          >
            {t('common.edit')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={Trash2}
            className="h-9 w-full justify-start rounded-md bg-muted/60 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            onClick={onDeleteClick}
          >
            {t('common.delete')}
          </Button>
          {canDuplicate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={Copy}
              className="h-9 w-full justify-start rounded-md bg-muted/60 px-3 text-xs hover:bg-muted"
              onClick={() => onDuplicate(slot)}
            >
              {t('common.duplicate')}
            </Button>
          )}
          {Array.isArray(detailFooterActions) &&
            detailFooterActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Icon}
                  disabled={action.disabled}
                  className="h-9 w-full justify-start rounded-md bg-muted/60 px-3 text-xs hover:bg-muted disabled:opacity-50"
                  onClick={() => action.onClick(slot)}
                >
                  {action.label}
                </Button>
              );
            })}
          {hasQuickEditChanges && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={Check}
              className="h-9 w-full justify-start rounded-md bg-green-600 px-3 text-xs text-white hover:bg-green-700"
              onClick={() => onApplyQuickEdit()}
            >
              {t('common.update')}
            </Button>
          )}
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
    <Card padding="none" className={SLOT_DETAIL_CARD_CLASS}>
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

interface SlotMainInfoCardProps {
  slot: Slot;
  displaySlot: Slot & Partial<Pick<Slot, 'location'>>;
  hasMatch: boolean;
  sourceMatch: Match | null;
  onMatchClick: () => void;
  onLocationDraftChange?: (value: string | null) => void;
}

function SlotMainInfoCard({
  slot,
  displaySlot,
  hasMatch,
  sourceMatch,
  onMatchClick,
  onLocationDraftChange,
}: SlotMainInfoCardProps) {
  const slotDatePassed = isSlotTimePast(slot.slot_time);
  const { t } = useTranslation();
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [locationEditValue, setLocationEditValue] = useState(
    () => displaySlot?.location ?? slot.location ?? '',
  );
  const locationInputRef = useRef<HTMLInputElement>(null);

  const startEditingLocation = useCallback(() => {
    if (!onLocationDraftChange) {
      return;
    }
    setLocationEditValue(displaySlot?.location ?? slot.location ?? '');
    setIsEditingLocation(true);
    setTimeout(() => locationInputRef.current?.focus(), 0);
  }, [onLocationDraftChange, displaySlot?.location, slot.location]);

  const applyLocationDraft = useCallback(() => {
    if (!onLocationDraftChange) {
      return;
    }
    const trimmed = locationEditValue.trim();
    const current = (displaySlot?.location ?? slot.location ?? '') || '';
    if (trimmed === current) {
      setIsEditingLocation(false);
      return;
    }
    onLocationDraftChange(trimmed || null);
    setIsEditingLocation(false);
  }, [onLocationDraftChange, locationEditValue, displaySlot?.location, slot.location]);

  const handleLocationKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyLocationDraft();
      }
      if (e.key === 'Escape') {
        setLocationEditValue(displaySlot?.location ?? slot.location ?? '');
        setIsEditingLocation(false);
        locationInputRef.current?.blur();
      }
    },
    [applyLocationDraft, displaySlot?.location, slot.location],
  );

  useEffect(() => {
    if (!isEditingLocation) {
      setLocationEditValue(displaySlot?.location ?? slot.location ?? '');
    }
  }, [displaySlot?.location, slot.location, isEditingLocation]);

  const displayName = slot.name?.trim() || `SLT ${formatDisplayNumber('slots', slot.id)}`;

  return (
    <Card padding="none" className={cn(SLOT_DETAIL_CARD_CLASS, 'plugin-slots')}>
      <div className="p-6 space-y-5">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
            {t('slots.nameLabel')}
          </div>
          <div className="text-2xl font-semibold text-foreground">{displayName}</div>
        </div>
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
          {onLocationDraftChange && isEditingLocation ? (
            <Input
              ref={locationInputRef}
              value={locationEditValue}
              onChange={(e) => setLocationEditValue(e.target.value)}
              onBlur={applyLocationDraft}
              onKeyDown={handleLocationKeyDown}
              className="h-8 text-base font-medium"
              placeholder={t('slots.locationPlaceholder')}
            />
          ) : onLocationDraftChange ? (
            <button
              type="button"
              onClick={startEditingLocation}
              className="text-base font-medium text-left w-full rounded px-2 py-1 -mx-2 -my-1 hover:bg-muted/60 transition-colors truncate"
            >
              {displaySlot?.location ?? slot.location ?? '—'}
            </button>
          ) : (
            <div className="text-base font-medium">{slot.location ?? '—'}</div>
          )}
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
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
              {t('slots.reservedForLater')}
            </div>
            <div className="text-sm font-medium text-muted-foreground">—</div>
          </div>
        </div>
        {slotDatePassed && (
          <p className="text-xs text-red-600 dark:text-red-400">{t('slots.slotDatePassed')}</p>
        )}
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
  openContactForView: (contact: { id: number | string; companyName?: string }) => void;
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
  openContactForView,
  bookings,
  bookingsLoading,
  onRequestDeleteBooking,
}: SlotSettingsCardProps) {
  const slotDatePassed = isSlotTimePast(slot.slot_time);
  const addableContacts = assignableContacts.filter(
    (c) => !displayMentions?.some((m) => String(m.contactId) === String(c.id)),
  );
  const { t } = useTranslation();

  return (
    <Card padding="none" className={cn(SLOT_DETAIL_CARD_CLASS, 'plugin-slots')}>
      <div className="p-6 space-y-5">
        <div className="space-y-2">
          <div
            className={cn(
              'flex items-center justify-between gap-2 rounded-md',
              slotDatePassed && 'opacity-55 text-muted-foreground',
            )}
            title={slotDatePassed ? t('slots.visibleDisabledPast') : undefined}
          >
            <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
              {t('common.visible')}
            </div>
            <Switch
              checked={!!displaySlot.visible}
              onCheckedChange={(checked) => setPropertyDraftField('visible', checked)}
              disabled={slotDatePassed}
              className="h-4 w-7 data-[state=checked]:bg-primary [&>span]:h-3 [&>span]:w-3 [&[data-state=checked]>span]:translate-x-3"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
              {t('common.notifications')}
            </div>
            <Switch
              checked={!!displaySlot.notifications_enabled}
              onCheckedChange={(checked) => setPropertyDraftField('notifications_enabled', checked)}
              className="h-4 w-7 data-[state=checked]:bg-primary [&>span]:h-3 [&>span]:w-3 [&[data-state=checked]>span]:translate-x-3"
            />
          </div>
        </div>
        <div className="space-y-2 border-t border-border/50 pt-5">
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
        </div>
        {(bookings.length > 0 || bookingsLoading) && (
          <div className="border-t border-border/50 pt-5 space-y-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {t('slots.publicBookings')}
            </div>
            {bookingsLoading ? (
              <div className="text-sm text-muted-foreground py-1">{t('common.loading')}</div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {bookings.map((booking) => {
                  const metaParts = [
                    booking.email || null,
                    booking.phone || null,
                    booking.message ? `"${booking.message}"` : null,
                  ].filter(Boolean);
                  return (
                    <div
                      key={booking.id}
                      className="rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-card-foreground"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{booking.name}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="whitespace-nowrap text-[10px] text-muted-foreground tabular-nums">
                            {formatDateTime(booking.created_at)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => onRequestDeleteBooking(booking)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {metaParts.length > 0 && (
                        <div className="mt-0.5 min-w-0 truncate text-xs text-muted-foreground">
                          {metaParts.join(' · ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
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
    deleteSlot,
    openSlotForEdit,
    getDuplicateConfig,
    executeDuplicate,
    detailFooterActions,
    hasQuickEditChanges,
    onApplyQuickEdit,
    getDeleteMessage,
  } = useSlotsContext();

  const [sourceMatch, setSourceMatch] = useState<Match | null>(null);
  const [matchLoaded, setMatchLoaded] = useState(false);
  const [bookings, setBookings] = useState<SlotBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<SlotBooking | null>(null);
  const [showDeleteSlotConfirm, setShowDeleteSlotConfirm] = useState(false);

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
      <div
        className={cn(
          'plugin-slots min-h-full bg-background px-4 py-5 sm:px-5 sm:py-6 rounded-xl',
          'md:-mx-6 md:-my-4 md:rounded-b-lg md:rounded-t-none',
        )}
      >
        <DetailLayout
          mainClassName="max-w-[920px]"
          sidebar={
            <div className="space-y-4">
              <SlotQuickActionsCard
                slot={slot}
                onEdit={openSlotForEdit}
                onDeleteClick={() => setShowDeleteSlotConfirm(true)}
                onDuplicate={(s) => executeDuplicate(s, '')}
                getDuplicateConfig={getDuplicateConfig}
                detailFooterActions={detailFooterActions}
                hasQuickEditChanges={hasQuickEditChanges}
                onApplyQuickEdit={onApplyQuickEdit}
              />
              <SlotMetadataCard
                slot={slot}
                hasMatch={hasMatch}
                sourceMatch={sourceMatch}
                onMatchClick={handleMatchClick}
              />
              <DetailActivityLog
                entityType="slot"
                entityId={slot.id}
                limit={30}
                title={t('slots.activity')}
                showClearButton
                refreshKey={slot.updated_at ?? slot.id}
              />
            </div>
          }
        >
          <div className="space-y-4">
            <SlotMainInfoCard
              slot={slot}
              displaySlot={displaySlot!}
              hasMatch={hasMatch}
              sourceMatch={sourceMatch}
              onMatchClick={handleMatchClick}
              onLocationDraftChange={(value) => setPropertyDraftField('location', value ?? null)}
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
              openContactForView={openContactForView}
              bookings={bookings}
              bookingsLoading={bookingsLoading}
              onRequestDeleteBooking={setBookingToDelete}
            />
          </div>
        </DetailLayout>
      </div>

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

      <ConfirmDialog
        isOpen={showDeleteSlotConfirm}
        title={t('dialog.deleteItem', { label: t('nav.slot') })}
        message={slot ? getDeleteMessage(slot) : ''}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={async () => {
          if (slot) {
            await deleteSlot(slot.id);
            setShowDeleteSlotConfirm(false);
          }
        }}
        onCancel={() => setShowDeleteSlotConfirm(false)}
        variant="danger"
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
        title={t('slots.deleteBooking')}
        message={t('slots.deleteBookingConfirm', {
          name: bookingToDelete?.name ?? '—',
        })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={handleDeleteBooking}
        onCancel={() => setBookingToDelete(null)}
        variant="destructive"
      />
    </>
  );
}
