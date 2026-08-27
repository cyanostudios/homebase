import { Link2, MapPin, SlidersHorizontal, Tag, User, Users, X } from 'lucide-react';
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
import { useApp } from '@/core/api/AppContext';
import { BulkEmailDialog } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_FIELD_LABEL_CLASS as FIELD_LABEL_CLASS,
  DETAIL_FIELD_VALUE_CLASS as FIELD_VALUE_CLASS,
  DETAIL_PROP_ROW_CLASS as PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS as CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import { ContactCopyableLink, mailtoHref, telHref } from './ContactCopyableLink';
import { ContactLinkedItemsSection } from './ContactLinkedItemsSection';
import { ContactQuickContextPanel } from './ContactQuickContextPanel';
import { useContacts } from '../hooks/useContacts';
import type { Contact } from '../types/contacts';
import { CONTACTS_SETTINGS_KEY } from '../utils/contactColumnCount';

interface ContactViewProps {
  contact: Contact;
}

export const ContactView = React.memo(function ContactView({ contact }: ContactViewProps) {
  const { t } = useTranslation();
  const { getSettings, settingsVersion } = useApp();

  const {
    openContactForEdit,
    showSendMessageDialog,
    sendMessageRecipients,
    closeSendMessageDialog,
    showSendEmailDialog,
    sendEmailRecipients,
    closeSendEmailDialog,
    displayTags,
    addTagToDraft,
    removeTagFromDraft,
    tagError,
    showDiscardTagsDialog,
    setShowDiscardTagsDialog,
    onDiscardTagsAndClose,
    setContactAssignable,
  } = useContacts();

  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagToAdd, setTagToAdd] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadTags = async () => {
      try {
        const settings = await getSettings(CONTACTS_SETTINGS_KEY);
        if (cancelled) {
          return;
        }
        const list = Array.isArray(settings?.tags) ? settings.tags : [];
        setAvailableTags(
          list
            .filter((item: unknown): item is string => typeof item === 'string')
            .map((item: string) => item.trim())
            .filter(Boolean),
        );
      } catch {
        if (!cancelled) {
          setAvailableTags([]);
        }
      }
    };
    void loadTags();
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const addableTags = useMemo(
    () =>
      availableTags.filter(
        (item) =>
          !displayTags.some((tag) => String(tag).toLowerCase() === String(item).toLowerCase()),
      ),
    [availableTags, displayTags],
  );

  if (!contact) {
    return null;
  }

  const isCompany = contact.contactType === 'company';

  return (
    <>
      <DetailLayout
        gridClassName="grid-cols-1 lg:grid-cols-2"
        leftSidebar={
          <div className="space-y-4">
            <ContactQuickContextPanel
              contact={contact}
              availableTags={availableTags}
              onEdit={() => openContactForEdit(contact)}
              variant="full"
            />
            {Array.isArray(contact.addresses) && contact.addresses.length > 0 ? (
              <Card padding="none" className={CARD_CLASS}>
                <DetailSection title="Addresses" icon={MapPin} subtleTitle className="p-6">
                  <div className="space-y-6">
                    {contact.addresses.map((address: any, idx: number) => (
                      <div
                        key={address.id}
                        className={cn('space-y-4', idx > 0 && 'border-t border-border/50 pt-6')}
                      >
                        <Badge className="border-0 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {address.type || 'Address'}
                        </Badge>
                        <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-4">
                          {address.addressLine1 ? (
                            <div className="col-span-2">
                              <div className={FIELD_LABEL_CLASS}>Address</div>
                              <div className={FIELD_VALUE_CLASS}>
                                {[address.addressLine1, address.addressLine2]
                                  .filter(Boolean)
                                  .join(', ')}
                              </div>
                            </div>
                          ) : null}
                          {address.postalCode || address.city ? (
                            <div>
                              <div className={FIELD_LABEL_CLASS}>Postal Code / City</div>
                              <div className={FIELD_VALUE_CLASS}>
                                {[address.postalCode, address.city].filter(Boolean).join(' ')}
                              </div>
                            </div>
                          ) : null}
                          {address.region ? (
                            <div>
                              <div className={FIELD_LABEL_CLASS}>Region</div>
                              <div className={FIELD_VALUE_CLASS}>{address.region}</div>
                            </div>
                          ) : null}
                          {address.country ? (
                            <div>
                              <div className={FIELD_LABEL_CLASS}>Country</div>
                              <div className={FIELD_VALUE_CLASS}>{address.country}</div>
                            </div>
                          ) : null}
                          {address.email ? (
                            <div>
                              <div className={FIELD_LABEL_CLASS}>Email</div>
                              <ContactCopyableLink
                                value={address.email}
                                href={mailtoHref(address.email)}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              </Card>
            ) : null}
          </div>
        }
      >
        <div className="space-y-4">
          <Card padding="none" className={CARD_CLASS}>
            <DetailSection
              title={t('contacts.contactProperties')}
              icon={SlidersHorizontal}
              subtleTitle
              className="p-6"
            >
              <div>
                <div className={PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Tax rate</span>
                  <span className={cn(FIELD_VALUE_CLASS, 'text-right')}>
                    {isCompany ? (contact.taxRate ? `${contact.taxRate}%` : '—') : '0%'}
                  </span>
                </div>
                <div className={PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Payment terms</span>
                  <span className={cn(FIELD_VALUE_CLASS, 'text-right')}>
                    {contact.paymentTerms ? `${contact.paymentTerms} days` : '—'}
                  </span>
                </div>
                <div className={PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Currency</span>
                  <span className={cn(FIELD_VALUE_CLASS, 'text-right')}>
                    {contact.currency || '—'}
                  </span>
                </div>
                {isCompany ? (
                  <div className={PROP_ROW_CLASS}>
                    <span className="text-sm text-slate-500 dark:text-slate-400">F-tax</span>
                    <span className={cn(FIELD_VALUE_CLASS, 'text-right')}>
                      {contact.fTax === 'yes' ? 'Registered' : 'No'}
                    </span>
                  </div>
                ) : null}
                <div className={PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Assignable</span>
                  <Select
                    value={contact.isAssignable ? 'yes' : 'no'}
                    onValueChange={(value) => {
                      void setContactAssignable(contact, value === 'yes');
                    }}
                  >
                    <SelectTrigger className="h-8 w-[180px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">{t('contacts.assignableYes')}</SelectItem>
                      <SelectItem value="no">{t('contacts.assignableNo')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(PROP_ROW_CLASS, 'items-start')}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Tags</span>
                  <div className="flex min-w-0 max-w-[70%] flex-col items-end gap-1.5">
                    <Select
                      value={tagToAdd || '__add_tag__'}
                      onValueChange={(value) => {
                        if (value && value !== '__add_tag__') {
                          addTagToDraft(value);
                          setTagToAdd('');
                        }
                      }}
                      disabled={addableTags.length === 0}
                    >
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue placeholder="Add a tag..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__add_tag__">
                          {addableTags.length === 0 ? 'No more tags to add' : 'Add a tag...'}
                        </SelectItem>
                        {addableTags.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {tagError ? <p className="text-xs text-destructive">{tagError}</p> : null}
                    {displayTags.length > 0 ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {displayTags.map((item: string) => (
                          <Badge
                            key={item}
                            variant="outline"
                            className="flex items-center gap-1 rounded-md border-border/60 bg-transparent text-xs font-medium text-foreground"
                          >
                            <Tag className="h-3 w-3" />
                            {item}
                            <button
                              type="button"
                              className="rounded p-0.5 hover:bg-muted"
                              onClick={() => removeTagFromDraft(item)}
                              aria-label={`Remove tag ${item}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No tags</span>
                    )}
                  </div>
                </div>
              </div>
            </DetailSection>
          </Card>

          {Array.isArray(contact.contactPersons) && contact.contactPersons.length > 0 && (
            <Card padding="none" className={CARD_CLASS}>
              <DetailSection title="Contact Persons" icon={Users} subtleTitle className="p-6">
                <div className="space-y-6">
                  {contact.contactPersons.map((person: any, idx: number) => {
                    const personInitials = (person.name || '')
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((n: string) => n[0].toUpperCase())
                      .join('');
                    return (
                      <div
                        key={person.id}
                        className={cn('space-y-4', idx > 0 && 'border-t border-border/50 pt-6')}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-sm font-extrabold text-slate-700 dark:from-slate-700 dark:to-slate-600 dark:text-slate-300">
                            {personInitials || <User className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold tracking-tight text-foreground leading-tight">
                              {person.name || '—'}
                            </div>
                            {person.title ? (
                              <div className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                                {person.title}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {person.email || person.phone ? (
                          <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8">
                            {person.email ? (
                              <div>
                                <div className={FIELD_LABEL_CLASS}>Email</div>
                                <ContactCopyableLink
                                  value={person.email}
                                  href={mailtoHref(person.email)}
                                />
                              </div>
                            ) : null}
                            {person.phone ? (
                              <div>
                                <div className={FIELD_LABEL_CLASS}>Phone</div>
                                <ContactCopyableLink
                                  value={person.phone}
                                  href={telHref(person.phone)}
                                />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </DetailSection>
            </Card>
          )}

          <Card padding="none" className={CARD_CLASS}>
            <DetailSection
              title={
                <span className="inline-flex items-baseline gap-2">
                  <span>{t('contacts.quickContext.linked')}</span>
                  <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
                    {t('contacts.quickContext.linkedHint')}
                  </span>
                </span>
              }
              icon={Link2}
              subtleTitle
              className="p-6"
            >
              <ContactLinkedItemsSection
                contact={contact}
                previewLimit={null}
                showHeading={false}
                showHint={false}
              />
            </DetailSection>
          </Card>
        </div>
      </DetailLayout>

      <ConfirmDialog
        isOpen={showDiscardTagsDialog}
        title={t('dialog.unsavedChanges')}
        message={t('contacts.discardTagsMessage')}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
        onConfirm={onDiscardTagsAndClose}
        onCancel={() => setShowDiscardTagsDialog(false)}
        variant="warning"
      />

      <BulkMessageDialog
        isOpen={showSendMessageDialog}
        onClose={closeSendMessageDialog}
        recipients={sendMessageRecipients}
        pluginSource="contacts"
      />

      <BulkEmailDialog
        isOpen={showSendEmailDialog}
        onClose={closeSendEmailDialog}
        recipients={sendEmailRecipients}
        pluginSource="contacts"
      />
    </>
  );
});
