import { Bell, CalendarDays, FileText, Info, MapPin, User, Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { QuickContextSection } from '@/core/ui/QuickContextSection';
import {
  QuickContextHeaderActions,
  QuickContextOpenFullFooter,
} from '@/core/ui/QuickContextHeaderActions';
import {
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { buildSlug } from '@/core/utils/slugUtils';
import { cn } from '@/lib/utils';
import { ContactQuickInfoDialog } from '@/plugins/contacts/components/ContactQuickInfoDialog';
import {
  CONTACT_TYPE_BADGE_CLASS,
  CONTACT_TYPE_COLORS,
  type Contact,
} from '@/plugins/contacts/types/contacts';

import type { Slot } from '../types/slots';
import { isSlotTimePast } from '../utils/slotTimeUtils';

import { CapacityAssignedDots } from './CapacityAssignedDots';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';
const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';
const LIST_CONTENT_PREVIEW_CHARS = 1200;

function slotTitle(slot: Slot): string {
  return slot.name?.trim() || `SLT ${slot.id}`;
}

function slotInitials(slot: Slot): string {
  const title = slotTitle(slot);
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return title.trim().slice(0, 2).toUpperCase() || '—';
}

function truncatePlainText(
  content: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  const plain = content.trim();
  if (!plain) {
    return { text: '', truncated: false };
  }
  if (plain.length <= maxChars) {
    return { text: plain, truncated: false };
  }
  const slice = plain.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxChars * 0.6 ? lastSpace : maxChars;
  return { text: `${plain.slice(0, cut).trimEnd()}…`, truncated: true };
}

export function SlotQuickContextPanel({
  slot,
  onClose,
  onOpenFullProfile,
  onEdit,
  variant = 'list',
}: {
  slot: Slot;
  onClose?: () => void;
  onOpenFullProfile?: () => void;
  onEdit: () => void;
  /** `list` = small preview beside the list; `full` = first column in full detail view. */
  variant?: 'list' | 'full';
}) {
  const isFullView = variant === 'full';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { contacts } = useApp();
  const [contentExpanded, setContentExpanded] = useState(false);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);

  useEffect(() => {
    setContentExpanded(false);
    setViewingContact(null);
  }, [slot.id]);

  const contactById = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const contact of contacts ?? []) {
      map.set(String(contact.id), contact as Contact);
    }
    return map;
  }, [contacts]);

  const uniqueMentions = useMemo(() => {
    const mentions = Array.isArray(slot.mentions) ? slot.mentions : [];
    return Array.from(new Map(mentions.map((m) => [m.contactId, m])).values());
  }, [slot.mentions]);

  const title = slotTitle(slot);
  const category = slot.category?.trim();
  const assignedCount = (slot.mentions?.length ?? 0) + (slot.booked_count ?? 0);
  const timePast = isSlotTimePast(slot.slot_time);
  const timeLabel = slot.slot_time ? formatDateTimeShort(slot.slot_time) : '—';
  const updatedLabel = slot.updated_at
    ? new Date(slot.updated_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const contentPreview = useMemo(() => {
    if (!slot.description?.trim()) {
      return { text: '', truncated: false };
    }
    return truncatePlainText(slot.description, LIST_CONTENT_PREVIEW_CHARS);
  }, [slot.description]);

  const displayedContent = contentExpanded ? slot.description?.trim() || '' : contentPreview.text;
  const showReadMoreToggle = contentPreview.truncated && !isFullView;

  const navigateToContact = (contact: Contact) => {
    setViewingContact(null);
    navigate(`/contacts/${buildSlug(contact, contacts ?? [], 'companyName')}`);
  };

  const identityHeader = (
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
        aria-hidden
      >
        {slotInitials(slot)}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h3 className="min-w-0 truncate text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {category ? (
          <Badge className={cn('shrink-0', BADGE_CLASS, 'bg-muted text-muted-foreground')}>
            {category}
          </Badge>
        ) : null}
      </div>
      <QuickContextHeaderActions
        onOpen={!isFullView && onOpenFullProfile ? onOpenFullProfile : undefined}
        onEdit={onEdit}
        onClose={!isFullView && onClose ? onClose : undefined}
        editLabel={t('common.edit')}
        closeLabel={t('common.close')}
      />
    </div>
  );

  return (
    <>
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
        <div className="border-b border-border/50 px-4 py-2.5">{identityHeader}</div>

        <div
          className={cn(
            'min-w-0 overflow-x-hidden px-4 py-4',
            isFullView ? 'space-y-4' : 'space-y-6',
          )}
        >
          {updatedLabel ? (
            <p className="text-xs text-muted-foreground">
              {t('common.updated')} {updatedLabel}
            </p>
          ) : null}

          {!isFullView ? (
            <QuickContextSection title={t('slots.information')} icon={Info} iconPlugin="slots">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <div className={FACT_LABEL_CLASS}>
                    <CalendarDays className="h-3 w-3" />
                    {t('slots.timeLabel')}
                  </div>
                  <div
                    className={cn(
                      DETAIL_FIELD_VALUE_CLASS,
                      timePast && 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {timeLabel}
                  </div>
                </div>
                <div>
                  <div className={FACT_LABEL_CLASS}>
                    <MapPin className="h-3 w-3" />
                    {t('slots.locationLabel')}
                  </div>
                  <div className={DETAIL_FIELD_VALUE_CLASS}>{slot.location?.trim() || '—'}</div>
                </div>
                <div>
                  <div className={FACT_LABEL_CLASS}>
                    <Users className="h-3 w-3" />
                    {t('common.capacity')}
                  </div>
                  <div className={DETAIL_FIELD_VALUE_CLASS}>
                    <span className="inline-flex items-center gap-1.5">
                      {slot.capacity}
                      <CapacityAssignedDots
                        capacity={slot.capacity}
                        assignedCount={assignedCount}
                      />
                    </span>
                  </div>
                </div>
                <div>
                  <div className={FACT_LABEL_CLASS}>{t('common.visible')}</div>
                  <div className={DETAIL_FIELD_VALUE_CLASS}>
                    {slot.visible ? t('common.yes') : t('common.no')}
                  </div>
                </div>
                <div>
                  <div className={FACT_LABEL_CLASS}>
                    <Bell className="h-3 w-3" />
                    {t('common.notifications')}
                  </div>
                  <div className={DETAIL_FIELD_VALUE_CLASS}>
                    {slot.notifications_enabled ? t('common.on') : t('common.off')}
                  </div>
                </div>
                {(slot.booked_count ?? 0) > 0 ? (
                  <div>
                    <div className={FACT_LABEL_CLASS}>{t('slots.publicBookings')}</div>
                    <div className={DETAIL_FIELD_VALUE_CLASS}>{slot.booked_count}</div>
                  </div>
                ) : null}
              </div>
            </QuickContextSection>
          ) : null}

          {!isFullView && displayedContent ? (
            <QuickContextSection
              title={t('slots.descriptionLabel')}
              icon={FileText}
              iconPlugin="slots"
            >
              <div className={DETAIL_NOTE_CALLOUT_CLASS}>
                <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                  {displayedContent}
                </p>
                {showReadMoreToggle ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                    onClick={() => setContentExpanded((open) => !open)}
                  >
                    {contentExpanded
                      ? t('slots.quickContext.showLess')
                      : t('slots.quickContext.readMore')}
                  </button>
                ) : null}
              </div>
            </QuickContextSection>
          ) : null}

          {!isFullView && uniqueMentions.length > 0 ? (
            <QuickContextSection
              title={t('slots.quickContext.contacts')}
              icon={User}
              iconPlugin="contacts"
            >
              <QuickContextLinkTileGrid>
                {uniqueMentions.slice(0, 6).map((mention) => {
                  const contactData = contactById.get(String(mention.contactId));
                  const isDeleted = !contactData;
                  const name =
                    contactData?.companyName ??
                    mention.contactName ??
                    mention.companyName ??
                    mention.contactId;
                  const typeKey = contactData?.contactType === 'private' ? 'private' : 'company';
                  return (
                    <QuickContextLinkTile
                      key={mention.contactId}
                      label={t('nav.contact')}
                      meta={
                        isDeleted ? t('contacts.deletedContact') : t(`contacts.type.${typeKey}`)
                      }
                      metaClassName={
                        isDeleted
                          ? 'border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          : CONTACT_TYPE_COLORS[typeKey]
                      }
                      icon={User}
                      iconClassName={isDeleted ? 'text-slate-400' : 'text-sky-600'}
                      onClick={contactData ? () => setViewingContact(contactData) : undefined}
                      className={isDeleted ? 'opacity-70' : undefined}
                    >
                      {name}
                    </QuickContextLinkTile>
                  );
                })}
              </QuickContextLinkTileGrid>
            </QuickContextSection>
          ) : null}
        </div>

        {!isFullView && onOpenFullProfile ? (
          <QuickContextOpenFullFooter onOpen={onOpenFullProfile} />
        ) : null}
      </Card>

      <ContactQuickInfoDialog
        isOpen={viewingContact !== null}
        contact={viewingContact}
        onClose={() => setViewingContact(null)}
        onOpenContact={() => {
          if (viewingContact) {
            navigateToContact(viewingContact);
          }
        }}
        badges={
          viewingContact ? (
            <span
              className={cn(
                CONTACT_TYPE_BADGE_CLASS,
                CONTACT_TYPE_COLORS[viewingContact.contactType],
              )}
            >
              {t(`contacts.type.${viewingContact.contactType}`)}
            </span>
          ) : null
        }
      />
    </>
  );
}
