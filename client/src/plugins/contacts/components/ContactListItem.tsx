import { Mail, Phone, Timer } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DETAIL_VIEW_CARD_CLASS,
  DETAIL_LIST_ITEM_HOVER_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';
import { ListSelectionCheckboxSlot } from '@/core/ui/ListSelectionCheckboxSlot';

import type { Contact } from '../types/contacts';
import { CONTACT_TYPE_BADGE_CLASS, CONTACT_TYPE_COLORS } from '../types/contacts';
import type { ContactColumnCount } from '../utils/contactColumnCount';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';

export function ContactListItem({
  contact,
  selected,
  highlighted,
  onClick,
  checkbox,
  hasTimeLogged = false,
  timeTrackingActive = false,
  columnCount = 1,
  active = false,
}: {
  contact: Contact;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  hasTimeLogged?: boolean;
  timeTrackingActive?: boolean;
  /** When 1, meta sits on the top row; 2/3 keep meta below title/excerpt. */
  columnCount?: ContactColumnCount;
  active?: boolean;
}) {
  const { t } = useTranslation();
  const updatedLabel = contact.updatedAt ? new Date(contact.updatedAt).toLocaleDateString() : null;
  const identifier =
    contact.contactType === 'company' && contact.organizationNumber
      ? `Org. ${contact.organizationNumber}`
      : contact.contactType === 'private' && contact.personalNumber
        ? `PN: ${contact.personalNumber.substring(0, 9)}XXXX`
        : null;
  const tags = Array.isArray(contact.tags) ? contact.tags.filter(Boolean) : [];
  const metaOnTop = columnCount === 1;
  const hasMeta = Boolean(contact.email || contact.phone || updatedLabel);

  const openOnKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  const metaRow = hasMeta ? (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
      {contact.email ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate font-medium text-foreground/80">{contact.email}</span>
        </span>
      ) : null}
      {contact.phone ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate tabular-nums">{contact.phone}</span>
        </span>
      ) : null}
      {updatedLabel ? (
        <span className="truncate">
          {t('common.updated')}: {updatedLabel}
        </span>
      ) : null}
    </div>
  ) : null;

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden p-0 transition-all',
        DETAIL_VIEW_CARD_CLASS,
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : DETAIL_LIST_ITEM_HOVER_CLASS,
        active && 'bg-primary/5 ring-1 ring-primary/40',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"], button')) {
          return;
        }
        onClick();
      }}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(contact)}
      data-plugin-name="contacts"
      role="button"
      tabIndex={0}
      aria-current={active ? 'true' : undefined}
      aria-label={`Open contact ${contact.companyName}`}
    >
      <div className="flex flex-col gap-2 p-4">
        <ListSelectionCheckboxSlot>{checkbox}</ListSelectionCheckboxSlot>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge
              className={cn(
                BADGE_CLASS,
                CONTACT_TYPE_BADGE_CLASS,
                CONTACT_TYPE_COLORS[contact.contactType],
              )}
            >
              {t(`contacts.type.${contact.contactType}`)}
            </Badge>
            {tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="h-5 border-border/50 px-1.5 text-[10px] font-extrabold"
              >
                {tag}
              </Badge>
            ))}
            {tags.length > 3 ? (
              <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>
            ) : null}
            {metaOnTop ? metaRow : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                contact.isAssignable ? 'bg-emerald-500' : 'bg-red-500',
              )}
              title={
                contact.isAssignable ? t('contacts.assignableYes') : t('contacts.assignableNo')
              }
              aria-label={
                contact.isAssignable ? t('contacts.assignableYes') : t('contacts.assignableNo')
              }
            />
            {timeTrackingActive ? (
              <span
                className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
                title={t('contacts.timeTrackingActive')}
              >
                <Timer className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">{t('contacts.timeTrackingActive')}</span>
              </span>
            ) : null}
            {hasTimeLogged ? (
              <Badge
                variant="outline"
                className="h-5 shrink-0 px-1.5 text-[10px] font-extrabold inline-flex items-center gap-1 bg-amber-50/60 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50"
              >
                <Timer className="h-2.5 w-2.5" aria-hidden />
                {t('contacts.timeLoggedBadge')}
              </Badge>
            ) : null}
          </div>
        </div>

        <h3 className={cn('line-clamp-2', DETAIL_LIST_ITEM_TITLE_CLASS)}>{contact.companyName}</h3>

        {identifier ? <p className="text-xs text-muted-foreground">{identifier}</p> : null}

        {!metaOnTop ? metaRow : null}
      </div>
    </Card>
  );
}
