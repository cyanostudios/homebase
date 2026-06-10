import { ChevronRight, Hash, Mail, Phone, Store, Timer } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import type { Contact } from '../types/contacts';
import { CONTACT_TYPE_BADGE_CLASS, CONTACT_TYPE_COLORS } from '../types/contacts';

function getContactInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function ContactTypeBadge({ type }: { type: Contact['contactType'] }) {
  const { t } = useTranslation();
  return (
    <Badge
      className={cn(
        'inline-flex flex-shrink-0',
        CONTACT_TYPE_BADGE_CLASS,
        CONTACT_TYPE_COLORS[type],
      )}
    >
      {t(`contacts.type.${type}`)}
    </Badge>
  );
}

export function ContactCard({
  contact,
  selected,
  highlighted,
  onClick,
  checkbox,
  hasTimeLogged = false,
  timeTrackingActive = false,
}: {
  contact: Contact;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  hasTimeLogged?: boolean;
  timeTrackingActive?: boolean;
}) {
  const { t } = useTranslation();
  const idLabel = formatDisplayNumber('contacts', contact.id);
  const updatedLabel = contact.updatedAt ? new Date(contact.updatedAt).toLocaleDateString() : null;
  const identifier =
    contact.contactType === 'company' && contact.organizationNumber
      ? contact.organizationNumber
      : contact.contactType === 'private' && contact.personalNumber
        ? `${contact.personalNumber.substring(0, 9)}XXXX`
        : null;

  return (
    <Card
      className={cn(
        'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border-0 bg-white p-0 shadow-sm transition-all dark:bg-slate-950',
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : 'hover:shadow-md',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
          return;
        }
        onClick();
      }}
      data-list-item={JSON.stringify(contact)}
      data-plugin-name="contacts"
      role="button"
      aria-label={`Open contact ${contact.companyName}`}
    >
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {checkbox}
            <div
              className={cn(
                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-foreground dark:from-slate-800 dark:to-slate-900',
                contact.contactType === 'private' && 'text-xs font-bold',
              )}
            >
              {contact.contactType === 'company' ? (
                <Store className="h-4 w-4" aria-hidden />
              ) : (
                getContactInitials(contact.companyName) || '?'
              )}
            </div>
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                {contact.companyName}
              </h3>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <ContactTypeBadge type={contact.contactType} />
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="min-w-0 truncate font-medium text-foreground/80">
              {contact.email || '—'}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="min-w-0 truncate">{contact.phone || '—'}</span>
          </div>
          {identifier ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="min-w-0 truncate">{identifier}</span>
            </div>
          ) : null}
        </div>

        {hasTimeLogged || timeTrackingActive ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {hasTimeLogged ? (
              <Badge
                variant="outline"
                className="h-5 border-transparent px-2 text-[10px] font-medium inline-flex items-center gap-1 bg-amber-50/60 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <Timer className="h-2.5 w-2.5" aria-hidden />
                {t('contacts.timeLoggedBadge')}
              </Badge>
            ) : null}
            {timeTrackingActive ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Timer className="h-3.5 w-3.5" aria-hidden />
                {t('contacts.timeTrackingActive')}
              </span>
            ) : null}
          </div>
        ) : null}

        {updatedLabel ? (
          <div className="mt-auto border-t border-border/60 pt-2.5">
            <span className="text-xs text-muted-foreground">
              <span className="font-mono">{idLabel}</span>
              <span className="mx-1.5 text-muted-foreground/50">·</span>
              {t('common.updated')}: {updatedLabel}
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
