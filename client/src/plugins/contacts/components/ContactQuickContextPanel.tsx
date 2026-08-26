import { Clock, Globe, Hash, Mail, Phone, Tag, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/core/api/apiFetch';
import {
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import {
  QuickContextHeaderActions,
  QuickContextOpenFullFooter,
} from '@/core/ui/QuickContextHeaderActions';
import { cn } from '@/lib/utils';

import { ContactCopyableLink, mailtoHref, telHref, websiteHref } from './ContactCopyableLink';
import { ContactLinkedItemsSection } from './ContactLinkedItemsSection';
import { useContacts } from '../hooks/useContacts';
import type { Contact } from '../types/contacts';
import {
  CONTACT_TYPE_BADGE_CLASS,
  CONTACT_TYPE_COLORS,
  formatCompanyTypeLabel,
} from '../types/contacts';

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || '—';
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

export function ContactQuickContextPanel({
  contact,
  availableTags,
  onClose,
  onOpenFullProfile,
  onEdit,
  variant = 'list',
}: {
  contact: Contact;
  availableTags: string[];
  onClose?: () => void;
  onOpenFullProfile?: () => void;
  onEdit: () => void;
  /** `list` = small preview beside the list; `full` = first column in full detail view. */
  variant?: 'list' | 'full';
}) {
  const isFullView = variant === 'full';
  const { t } = useTranslation();
  const { applyTagToContact, removeTagFromContact, setContactHasTimeEntries } = useContacts();
  const [tagToAdd, setTagToAdd] = useState('');
  const [timeEntries, setTimeEntries] = useState<
    { id: string; seconds: number; loggedAt: string }[] | null
  >(null);

  const displayTags = Array.isArray(contact.tags) ? contact.tags.filter(Boolean) : [];
  const isCompany = contact.contactType === 'company';
  const contactNotes = contact.notes?.trim() || '';

  const addableTags = useMemo(
    () =>
      availableTags.filter(
        (item) =>
          !displayTags.some((tag) => String(tag).toLowerCase() === String(item).toLowerCase()),
      ),
    [availableTags, displayTags],
  );

  useEffect(() => {
    if (isFullView || !contact?.id) {
      setTimeEntries(null);
      return;
    }
    let cancelled = false;
    const contactId = contact.id;
    setTimeEntries(null);
    void (async () => {
      try {
        const response = await apiFetch(`/api/contacts/${contactId}/time-entries`);
        if (!response.ok) {
          if (!cancelled) setTimeEntries([]);
          return;
        }
        const data = await response.json();
        if (!cancelled) setTimeEntries(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setTimeEntries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isFullView, contact?.id]);

  useEffect(() => {
    if (isFullView || !contact?.id || timeEntries === null) {
      return;
    }
    setContactHasTimeEntries(contact.id, timeEntries.length > 0);
  }, [isFullView, contact?.id, timeEntries, setContactHasTimeEntries]);

  const avatarClass = isCompany
    ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';

  const identityHeader = (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          avatarClass,
        )}
        aria-hidden
      >
        {contactInitials(contact.companyName)}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-base font-semibold leading-snug tracking-tight text-foreground sm:text-lg">
          {contact.companyName}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge
              className={cn(
                'shrink-0',
                CONTACT_TYPE_BADGE_CLASS,
                CONTACT_TYPE_COLORS[contact.contactType],
              )}
            >
              {t(`contacts.type.${contact.contactType}`)}
            </Badge>
            {!isFullView ? (
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
            ) : null}
          </div>
          <QuickContextHeaderActions
            onOpen={!isFullView && onOpenFullProfile ? onOpenFullProfile : undefined}
            onEdit={onEdit}
            onClose={!isFullView && onClose ? onClose : undefined}
            editLabel={t('contacts.edit')}
            closeLabel={t('common.close')}
          />
        </div>
      </div>
    </div>
  );

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
      <div className="border-b border-border/50 px-4 py-3">{identityHeader}</div>

      <div className={cn('px-4 py-4', isFullView ? 'space-y-4' : 'space-y-6')}>
        <div className="grid grid-cols-1 gap-y-3 md:grid-cols-2 md:gap-x-4">
          <div>
            <div className={FACT_LABEL_CLASS}>
              <Hash className="h-3 w-3" />
              Contact #
            </div>
            <div className={DETAIL_FIELD_VALUE_CLASS}>{contact.contactNumber || '—'}</div>
          </div>
          {isCompany ? (
            <div>
              <div className={FACT_LABEL_CLASS}>Company type</div>
              <div className={DETAIL_FIELD_VALUE_CLASS}>
                {formatCompanyTypeLabel(contact.companyType)}
              </div>
            </div>
          ) : (
            <div>
              <div className={FACT_LABEL_CLASS}>{t('contacts.quickInfo.personalNumber')}</div>
              <div className={DETAIL_FIELD_VALUE_CLASS}>{contact.personalNumber || '—'}</div>
            </div>
          )}
          {isCompany ? (
            <>
              <div>
                <div className={FACT_LABEL_CLASS}>{t('contacts.quickInfo.organizationNumber')}</div>
                <ContactCopyableLink value={contact.organizationNumber} />
              </div>
              <div>
                <div className={FACT_LABEL_CLASS}>VAT Number</div>
                <div className={DETAIL_FIELD_VALUE_CLASS}>{contact.vatNumber || '—'}</div>
              </div>
            </>
          ) : null}
          <div>
            <div className={FACT_LABEL_CLASS}>
              <Mail className="h-3 w-3" />
              {t('contacts.quickInfo.email')}
            </div>
            <ContactCopyableLink value={contact.email} href={mailtoHref(contact.email)} />
          </div>
          <div>
            <div className={FACT_LABEL_CLASS}>
              <Globe className="h-3 w-3" />
              Website
            </div>
            <ContactCopyableLink
              value={contact.website}
              href={websiteHref(contact.website)}
              openInNewTab
            />
          </div>
          <div>
            <div className={FACT_LABEL_CLASS}>
              <Phone className="h-3 w-3" />
              Phone 1
            </div>
            <ContactCopyableLink value={contact.phone} href={telHref(contact.phone)} />
          </div>
          <div>
            <div className={FACT_LABEL_CLASS}>
              <Phone className="h-3 w-3" />
              Phone 2
            </div>
            <ContactCopyableLink value={contact.phone2} href={telHref(contact.phone2)} />
          </div>
        </div>

        {contactNotes ? (
          <div>
            <div className="mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {t('contacts.relatedNotes')}
              </span>
            </div>
            <div className={DETAIL_NOTE_CALLOUT_CLASS}>
              <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                {contactNotes}
              </p>
            </div>
          </div>
        ) : null}

        {!isFullView ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {t('contacts.table.tags')}
              </span>
              <Select
                value={tagToAdd || '__add_tag__'}
                onValueChange={(value) => {
                  if (value && value !== '__add_tag__') {
                    void applyTagToContact(contact, value);
                    setTagToAdd('');
                  }
                }}
                disabled={addableTags.length === 0}
              >
                <SelectTrigger
                  className="h-8 w-[140px] text-xs"
                  aria-label={t('contacts.quickContext.addTag')}
                >
                  <SelectValue placeholder={t('contacts.quickContext.addTag')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__add_tag__">
                    {addableTags.length === 0
                      ? t('contacts.quickContext.noMoreTags')
                      : t('contacts.quickContext.addTag')}
                  </SelectItem>
                  {addableTags.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {displayTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {displayTags.map((item) => (
                  <Badge
                    key={item}
                    className="flex items-center gap-1 rounded-md border-0 bg-slate-100 text-xs font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <Tag className="h-3 w-3" />
                    {item}
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted"
                      onClick={() => void removeTagFromContact(contact, item)}
                      aria-label={t('contacts.quickContext.removeTag', { tag: item })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="block text-xs text-muted-foreground">
                {t('contacts.quickContext.noTags')}
              </span>
            )}
          </div>
        ) : null}

        {!isFullView ? (
          <ContactLinkedItemsSection contact={contact} previewLimit={6} hideWhenEmpty />
        ) : null}

        {!isFullView && timeEntries !== null && timeEntries.length > 0 ? (
          <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-3 dark:border-amber-800/50 dark:bg-amber-950/40">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-amber-700 dark:text-amber-300" aria-hidden />
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">
                Time log
              </span>
            </div>
            <div className="space-y-1.5">
              {timeEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-amber-200/60 bg-amber-50/80 px-2.5 py-1.5 dark:border-amber-800/50 dark:bg-amber-950/50"
                >
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    {formatDuration(entry.seconds)} -{' '}
                    {new Date(entry.loggedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {!isFullView && onOpenFullProfile ? (
        <QuickContextOpenFullFooter onOpen={onOpenFullProfile} />
      ) : null}
    </Card>
  );
}
