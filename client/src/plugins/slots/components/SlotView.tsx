import {
  AlertCircle,
  CalendarDays,
  Copy,
  Download,
  Info,
  Search,
  SlidersHorizontal,
  Trash2,
  User,
  Users,
  Zap,
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
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import type { ExportFormat } from '@/core/utils/exportUtils';
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
const PANEL_MAX_WIDTH = 'max-w-[920px]';

const quickActionButtonClass = 'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted';

// ─── Sub-components (extracted from SlotView) ─────────────────────────────────

interface SlotExportOptionsCardProps {
  slot: Slot;
  exportFormats: ExportFormat[];
  onExportItem: (format: ExportFormat, item: Slot) => void;
}

function SlotExportOptionsCard({ slot, exportFormats, onExportItem }: SlotExportOptionsCardProps) {
  const { t } = useTranslation();
  if (!Array.isArray(exportFormats) || exportFormats.length === 0) {
    return null;
  }

  const exportLabelByFormat: Record<string, string> = {
    txt: t('common.exportTxt'),
    csv: t('common.exportCsv'),
    pdf: t('common.exportPdf'),
  };

  return (
    <Card padding="none" className={SLOT_DETAIL_CARD_CLASS}>
      <DetailSection
        title={t('slots.exportOptions')}
        icon={Download}
        iconPlugin="slots"
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1.5">
          {exportFormats.map((format) => (
            <Button
              key={format}
              type="button"
              variant="ghost"
              size="sm"
              icon={Download}
              className={quickActionButtonClass}
              onClick={() => onExportItem(format, slot)}
            >
              {exportLabelByFormat[format] ?? `Export ${format.toUpperCase()}`}
            </Button>
          ))}
        </div>
      </DetailSection>
    </Card>
  );
}

interface SlotQuickActionsCardProps {
  slot: Slot;
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
}

function SlotQuickActionsCard({
  slot,
  onDeleteClick,
  onDuplicate,
  getDuplicateConfig,
  detailFooterActions,
}: SlotQuickActionsCardProps) {
  const { t } = useTranslation();
  const canDuplicate = Boolean(getDuplicateConfig(slot));
  const getActionIconColorClass = (actionId: string) => {
    if (actionId === 'send-message') {
      return 'text-violet-600 dark:text-violet-400';
    }
    if (actionId === 'send-email') {
      return 'text-red-600 dark:text-red-400';
    }
    return '';
  };
  return (
    <Card padding="none" className={SLOT_DETAIL_CARD_CLASS}>
      <DetailSection title={t('slots.quickActions')} icon={Zap} iconPlugin="slots" className="p-4">
        <div className="flex flex-col items-start gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={(props) => (
              <Trash2
                {...props}
                className={cn(props.className, 'text-red-600 dark:text-red-400')}
              />
            )}
            className="h-9 justify-start rounded-md px-3 text-xs hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={onDeleteClick}
          >
            {t('common.delete')}
          </Button>
          {canDuplicate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={(props) => (
                <Copy
                  {...props}
                  className={cn(props.className, 'text-green-600 dark:text-green-400')}
                />
              )}
              className="h-9 justify-start rounded-md px-3 text-xs hover:bg-muted"
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
                  icon={(props) => (
                    <Icon
                      {...props}
                      className={cn(props.className, getActionIconColorClass(action.id))}
                    />
                  )}
                  disabled={action.disabled}
                  className={cn(
                    'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted disabled:opacity-50',
                    action.className,
                  )}
                  onClick={() => action.onClick(slot)}
                >
                  {action.label}
                </Button>
              );
            })}
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
  hasMatch: boolean;
  sourceMatch: Match | null;
  onMatchClick: () => void;
}

function SlotMainInfoCard({ slot, hasMatch, sourceMatch, onMatchClick }: SlotMainInfoCardProps) {
  const slotDatePassed = isSlotTimePast(slot.slot_time);
  const { t } = useTranslation();

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
      <Card padding="none" className={cn(SLOT_DETAIL_CARD_CLASS, 'overflow-visible relative z-30')}>
        <div className="p-6 space-y-2">
          <div className="mb-1 flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-sm font-semibold text-foreground">
              {t('slots.properties')}
            </span>
          </div>
          <div
            className={cn(
              'flex items-center justify-between rounded-lg border border-border p-4',
              slotDatePassed && 'opacity-55 text-muted-foreground',
            )}
            title={slotDatePassed ? t('slots.visibleDisabledPast') : undefined}
          >
            <div className="space-y-0.5">
              <div className="text-sm font-medium">{t('slots.visibleLabel')}</div>
              <p className="text-[11px] text-muted-foreground">{t('slots.visibleHelp')}</p>
            </div>
            <Switch
              checked={!!displaySlot.visible}
              onCheckedChange={(checked) => setPropertyDraftField('visible', checked)}
              disabled={slotDatePassed}
              className="h-4 w-7 data-[state=checked]:bg-primary [&>span]:h-3 [&>span]:w-3 [&[data-state=checked]>span]:translate-x-3"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">{t('slots.notificationsLabel')}</div>
              <p className="text-[11px] text-muted-foreground">{t('slots.notificationsHelp')}</p>
            </div>
            <Switch
              checked={!!displaySlot.notifications_enabled}
              onCheckedChange={(checked) => setPropertyDraftField('notifications_enabled', checked)}
              className="h-4 w-7 data-[state=checked]:bg-primary [&>span]:h-3 [&>span]:w-3 [&[data-state=checked]>span]:translate-x-3"
            />
          </div>
        </div>
      </Card>

      <Card padding="none" className={SLOT_DETAIL_CARD_CLASS}>
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
        <Card padding="none" className={SLOT_DETAIL_CARD_CLASS}>
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
    deleteSlot,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedSlotId,
    detailFooterActions,
    getDeleteMessage,
    exportFormats,
    onExportItem,
  } = useSlotsContext();

  const [sourceMatch, setSourceMatch] = useState<Match | null>(null);
  const [matchLoaded, setMatchLoaded] = useState(false);
  const [bookings, setBookings] = useState<SlotBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<SlotBooking | null>(null);
  const [showDeleteSlotConfirm, setShowDeleteSlotConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

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
          mainClassName={PANEL_MAX_WIDTH}
          sidebar={
            <div className="space-y-4">
              <SlotQuickActionsCard
                slot={slot}
                onDeleteClick={() => setShowDeleteSlotConfirm(true)}
                onDuplicate={() => setShowDuplicateDialog(true)}
                getDuplicateConfig={getDuplicateConfig}
                detailFooterActions={detailFooterActions}
              />
              <SlotExportOptionsCard
                slot={slot}
                exportFormats={exportFormats}
                onExportItem={onExportItem}
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

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(slot, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedSlotId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={getDuplicateConfig(slot)?.defaultName ?? ''}
        nameLabel={getDuplicateConfig(slot)?.nameLabel ?? 'Name'}
        confirmOnly={Boolean(getDuplicateConfig(slot)?.confirmOnly)}
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
        variant="danger"
      />
    </>
  );
}
